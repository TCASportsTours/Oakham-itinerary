import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '@/data/db'
import { setSession } from '@/data/repo'
import { seedUser } from '@/data/seed'
import { estimateMeal, estimateTotals, logEstimate, scaleItem, setConsent, setMealPhotoHttp } from './mealPhoto'
import { foodLog } from './meals'

const chicken = { name: 'Grilled chicken breast', grams: 180, kcal: 297, protein: 56, carbs: 0, fat: 6.5 }
const rice = { name: 'Basmati rice', grams: 200, kcal: 260, protein: 5.4, carbs: 56, fat: 0.8 }

beforeEach(async () => {
  openDatabase(`mp-${Math.random()}`)
  setSession('u', false)
  await seedUser('u')
})

describe('meal photo estimates', () => {
  it('scales an item in proportion to its weight', () => {
    expect(scaleItem(rice, 300)).toEqual({ name: 'Basmati rice', grams: 300, kcal: 390, protein: 8.1, carbs: 84, fat: 1.2 })
  })

  it('totals the items', () => {
    expect(estimateTotals([chicken, rice])).toEqual({ kcal: 557, protein: 61.4, carbs: 56, fat: 7.3 })
  })

  it('will not send a photo until estimates are turned on', async () => {
    await expect(estimateMeal(new Blob(['x'], { type: 'image/jpeg' }))).rejects.toThrow(/Turn on/)
  })

  it('posts the photo and returns the estimate; server errors are shown', async () => {
    await setConsent(true)
    let sent: { image: string; description: string } | undefined
    setMealPhotoHttp((async (_u: RequestInfo | URL, init?: RequestInit) => {
      sent = JSON.parse(String(init!.body))
      return new Response(JSON.stringify({ is_food: true, items: [chicken], confidence: 'high', notes: '' }))
    }) as typeof fetch)
    const est = await estimateMeal(new Blob(['abc'], { type: 'image/jpeg' }), ' chicken ')
    expect(est.items[0].kcal).toBe(297)
    expect(sent).toMatchObject({ image: btoa('abc'), description: 'chicken' })
    setMealPhotoHttp((async () => new Response(JSON.stringify({ error: 'Daily limit reached' }), { status: 429 })) as typeof fetch)
    await expect(estimateMeal(new Blob(['abc'], { type: 'image/jpeg' }))).rejects.toThrow('Daily limit reached')
  })

  it('logs the adjusted estimate as eaten', async () => {
    await logEstimate('2026-11-01', 'dinner', [chicken, scaleItem(rice, 150)])
    const [entry] = await foodLog('2026-11-01')
    expect(entry).toMatchObject({ name: 'Photo estimate: grilled chicken breast, basmati rice', kcal: 492, slot: 'dinner' })
  })
})
