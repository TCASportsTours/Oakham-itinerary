// Estimates the food in a meal photo with Claude. The Anthropic API key stays
// on the server (Netlify env ANTHROPIC_API_KEY). The photo is not stored.
// Optional env: MEAL_PHOTO_DAILY_LIMIT (default 40), MEAL_PHOTO_ALLOWED_ORIGIN.
import Anthropic from '@anthropic-ai/sdk'
import { getStore } from '@netlify/blobs'

export const MODEL = 'claude-opus-5-5'
const MAX_IMAGE_BYTES = 1_500_000

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

const nutrient = { type: 'number', description: 'Grams for the estimated portion' }
export const ESTIMATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'items', 'confidence', 'notes'],
  properties: {
    is_food: { type: 'boolean', description: 'False if the photo does not show food or drink' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
        properties: {
          name: { type: 'string', description: 'Plain British name, e.g. "Grilled chicken breast"' },
          grams: { type: 'number', description: 'Estimated cooked weight on the plate' },
          kcal: { type: 'number' },
          protein: nutrient,
          carbs: nutrient,
          fat: nutrient,
        },
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    notes: { type: 'string', description: 'One or two short sentences on the main assumptions (hidden oil, sauces, portion size)' },
  },
}

export const SYSTEM = `You estimate the nutrition of a meal from a photo for a UK fitness diary.
Identify each separate food or drink you can see, estimate its portion weight in grams as served, and give energy (kcal) and protein, carbohydrate and fat (g) for that portion using typical UK food-composition values.
Use cooked weights for cooked foods. Allow for visible oil, butter and sauces and mention them in notes. Plate size and cutlery are useful scale references.
Be realistic rather than flattering: do not round portions down. If something is ambiguous, pick the most likely option and say so in notes.
If the user adds a description, trust it for what the food is and how much there is.
If the photo does not show food, set is_food to false and return no items.`

async function checkDailyLimit(store, limit) {
  const day = new Date().toISOString().slice(0, 10)
  const key = `count-${day}`
  const used = Number((await store.get(key)) ?? 0)
  if (used >= limit) return false
  await store.set(key, String(used + 1))
  return true
}

export default async function handler(req, _context, deps = {}) {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' })
  if (!process.env.ANTHROPIC_API_KEY && !deps.client) return json(503, { error: 'Meal photo estimates are not set up on the server yet (ANTHROPIC_API_KEY).' })
  const allowed = process.env.MEAL_PHOTO_ALLOWED_ORIGIN
  if (allowed && req.headers.get('origin') !== allowed) return json(403, { error: 'Not allowed' })

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const { image, media_type: mediaType = 'image/jpeg', description = '' } = body ?? {}
  if (typeof image !== 'string' || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) return json(400, { error: 'Send a JPEG, PNG or WebP image' })
  if ((image.length * 3) / 4 > MAX_IMAGE_BYTES) return json(413, { error: 'Image too large' })

  const store = deps.store ?? getStore('meal-photo')
  const limit = Number(process.env.MEAL_PHOTO_DAILY_LIMIT ?? 40)
  if (!(await checkDailyLimit(store, limit))) return json(429, { error: `Daily limit of ${limit} photo estimates reached. Try again tomorrow.` })

  const client = deps.client ?? new Anthropic()
  let response
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESTIMATE_SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: description ? `My description: ${String(description).slice(0, 500)}` : 'Estimate this meal.' },
          ],
        },
      ],
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: 'The estimator is busy. Try again in a minute.' })
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: 'The server’s Anthropic API key is not valid.' })
    if (e instanceof Anthropic.APIError) return json(502, { error: `Estimate failed (${e.status ?? 'network'}).` })
    throw e
  }
  if (response.stop_reason === 'refusal') return json(422, { error: 'This photo could not be estimated. Try another photo or log the meal by hand.' })
  if (response.stop_reason === 'max_tokens') return json(502, { error: 'The estimate was cut short. Please try again.' })
  const text = response.content.find((b) => b.type === 'text')?.text
  let estimate
  try {
    estimate = JSON.parse(text ?? '')
  } catch {
    return json(502, { error: 'The estimate could not be read. Please try again.' })
  }
  return json(200, { ...estimate, model: response.model })
}
