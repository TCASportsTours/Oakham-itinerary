// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import handler, { ESTIMATE_SCHEMA, MODEL } from './meal-photo.mjs'

const memoryStore = () => {
  const m = new Map()
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), m }
}
const fakeClient = (response) => {
  const calls = []
  return { calls, beta: { messages: { create: async (params) => (calls.push(params), response) } } }
}
const ok = (estimate) => ({ stop_reason: 'end_turn', model: MODEL, content: [{ type: 'text', text: JSON.stringify(estimate) }] })
const post = (body) => new Request('https://app.test/.netlify/functions/meal-photo', { method: 'POST', body: JSON.stringify(body) })
const meal = { is_food: true, items: [{ name: 'Grilled chicken breast', grams: 180, kcal: 297, protein: 56, carbs: 0, fat: 6.5 }], confidence: 'medium', notes: 'Assumed no oil.' }

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.MEAL_PHOTO_DAILY_LIMIT
})

describe('meal-photo function', () => {
  it('reports clearly when no API key is configured', async () => {
    expect((await handler(post({ image: 'aGk=' }))).status).toBe(503)
  })

  it('sends the photo to Claude with structured output and fallbacks, and returns the estimate', async () => {
    const client = fakeClient(ok(meal))
    const res = await handler(post({ image: 'aGk=', media_type: 'image/jpeg', description: 'chicken' }), {}, { client, store: memoryStore() })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ items: meal.items, confidence: 'medium' })
    const p = client.calls[0]
    expect(p.model).toBe('claude-opus-5-5')
    expect(p.fallbacks).toBe('default')
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01'])
    expect(p.output_config).toEqual({ effort: 'medium', format: { type: 'json_schema', schema: ESTIMATE_SCHEMA } })
    expect(p.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGk=' } })
    expect(p.messages[0].content[1].text).toContain('chicken')
  })

  it('handles refusals, bad input, oversize images and the daily limit', async () => {
    const store = memoryStore()
    expect((await handler(post({ image: 'aGk=' }), {}, { client: fakeClient({ stop_reason: 'refusal', content: [] }), store })).status).toBe(422)
    expect((await handler(post({ image: 'aGk=', media_type: 'image/gif' }), {}, { client: fakeClient(ok(meal)), store })).status).toBe(400)
    expect((await handler(post({ image: 'A'.repeat(2_100_000) }), {}, { client: fakeClient(ok(meal)), store })).status).toBe(413)
    process.env.MEAL_PHOTO_DAILY_LIMIT = '2'
    const s2 = memoryStore()
    const c = fakeClient(ok(meal))
    expect((await handler(post({ image: 'aGk=' }), {}, { client: c, store: s2 })).status).toBe(200)
    expect((await handler(post({ image: 'aGk=' }), {}, { client: c, store: s2 })).status).toBe(200)
    expect((await handler(post({ image: 'aGk=' }), {}, { client: c, store: s2 })).status).toBe(429)
    expect(c.calls).toHaveLength(2)
  })

  it('the schema is valid for structured outputs (closed objects, all fields required)', () => {
    const item = ESTIMATE_SCHEMA.properties.items.items
    expect(ESTIMATE_SCHEMA.additionalProperties).toBe(false)
    expect(item.additionalProperties).toBe(false)
    expect(item.required.sort()).toEqual(Object.keys(item.properties).sort())
    expect(ESTIMATE_SCHEMA.required.sort()).toEqual(Object.keys(ESTIMATE_SCHEMA.properties).sort())
  })
})
