import { db } from '@/data/db'
import { getUserId } from '@/data/repo'
import type { MealSlot } from '@/data/types'
import { logCustomFood } from './meals'
import { decodeImage, renderPhoto } from './photos'

/** Shown only once the server has an Anthropic API key (VITE_MEAL_PHOTO=1 at build time). */
export const mealPhotoAvailable = import.meta.env.VITE_MEAL_PHOTO === '1' && !import.meta.env.VITE_EMBED
const ENDPOINT = '/.netlify/functions/meal-photo'
/** Long edge sent to the estimator: enough detail to identify food, small enough to upload quickly. */
export const ESTIMATE_IMAGE_MAX = 1024

export interface EstimateItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface MealEstimate {
  is_food: boolean
  items: EstimateItem[]
  confidence: 'low' | 'medium' | 'high'
  notes: string
}

let http: typeof fetch = (input, init) => fetch(input, init)
export const setMealPhotoHttp = (fn: typeof fetch) => (http = fn)

const consentKey = () => `meal-photo-consent:${getUserId()}`
export const hasConsent = async () => Boolean((await db.meta.get(consentKey()))?.value)
export const setConsent = (on: boolean) => db.meta.put({ key: consentKey(), value: on })

async function toBase64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Downscale and re-encode as JPEG (also strips the original's location metadata). */
export async function prepareMealImage(file: Blob) {
  const img = await decodeImage(file)
  return renderPhoto(img, { rotation: 0, zoom: 1, offsetX: 0, offsetY: 0, aspect: null }, ESTIMATE_IMAGE_MAX)
}

export async function estimateMeal(image: Blob, description = ''): Promise<MealEstimate> {
  if (!(await hasConsent())) throw new Error('Turn on photo estimates first.')
  const res = await http(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: await toBase64(image), media_type: image.type || 'image/jpeg', description: description.trim() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Estimate failed (${res.status})`)
  return data as MealEstimate
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Change an item's portion; nutrients scale in proportion to the weight. */
export function scaleItem(item: EstimateItem, grams: number): EstimateItem {
  const f = item.grams > 0 ? grams / item.grams : 0
  return { ...item, grams, kcal: Math.round(item.kcal * f), protein: r1(item.protein * f), carbs: r1(item.carbs * f), fat: r1(item.fat * f) }
}

export function estimateTotals(items: EstimateItem[]) {
  return items.reduce(
    (t, i) => ({ kcal: t.kcal + i.kcal, protein: r1(t.protein + i.protein), carbs: r1(t.carbs + i.carbs), fat: r1(t.fat + i.fat) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function logEstimate(date: string, slot: MealSlot | 'ride', items: EstimateItem[], name?: string) {
  const t = estimateTotals(items)
  return logCustomFood(date, slot, { name: name?.trim() || `Photo estimate: ${items.map((i) => i.name.toLowerCase()).join(', ')}`, ...t })
}
