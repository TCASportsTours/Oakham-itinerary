import { describe, expect, it } from 'vitest'
import { kgToStLb, stLbToKg, formatWeight, cmToFtIn, ftInToCm, formatHeight } from './units'
import { ukUnits, alcoholKcal } from './alcohol'
import { macroTargets, inferDayType } from './nutrition'
import { rollingAverage, byDate } from './stats'
import { localDate, weekDates } from './dates'

describe('units', () => {
  it('converts kg ⇄ stones/pounds', () => {
    expect(kgToStLb(88.9)).toEqual({ st: 14, lb: 0 })
    expect(stLbToKg(14, 0)).toBeCloseTo(88.904, 2)
    expect(stLbToKg(13, 7)).toBeCloseTo(85.73, 2)
    expect(formatWeight(83, 'st')).toBe('13st 1lb (83.0kg)')
    expect(formatWeight(83, 'kg')).toBe('83.0kg')
  })
  it('converts cm ⇄ feet/inches', () => {
    expect(cmToFtIn(175)).toEqual({ ft: 5, inch: 8.9 })
    expect(ftInToCm(5, 9)).toBeCloseTo(175.26, 2)
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, inch: 0 })
    expect(formatHeight(175)).toBe('5ft 9in (175cm)')
  })
})

describe('alcohol', () => {
  it('matches the brief: 50ml of 40% rum = 2 units, ~110 kcal', () => {
    expect(ukUnits(50, 40)).toBe(2)
    expect(alcoholKcal(50, 40)).toBeCloseTo(110.5, 0)
  })
})

describe('nutrition', () => {
  it('splits a calorie target into reconciling grams', () => {
    const t = macroTargets(2600, 170, 0.27)
    expect(Math.abs(t.reconciledKcal - 2600)).toBeLessThan(10)
    expect(t.protein).toBe(170)
  })
  it('infers day types', () => {
    expect(inferDayType(['ride', 'social'], ['moderate'])).toBe('social_cycling')
    expect(inferDayType(['workout', 'ride'], ['easy'])).toBe('gym')
    expect(inferDayType(['ride'], ['long'])).toBe('cycling')
    expect(inferDayType(['recovery'], [])).toBe('rest')
  })
})

describe('stats', () => {
  it('computes a 7-day rolling average without inventing data', () => {
    const r = rollingAverage([
      { date: '2026-11-01', value: 90 },
      { date: '2026-11-03', value: 88 },
      { date: '2026-11-08', value: 86 },
      { date: '2026-11-09', value: 85 },
    ])
    expect(r.map((x) => Math.round(x.value * 100) / 100)).toEqual([90, 89, 87, 86.33])
  })
  it('orders chart data by date', () => {
    expect(byDate([{ date: '2026-02-01', value: 1 }, { date: '2026-01-01', value: 2 }]).map((x) => x.date)).toEqual(['2026-01-01', '2026-02-01'])
  })
})

describe('dates', () => {
  it('uses Europe/London calendar dates across DST changes', () => {
    // 23:30 UTC on 29 Mar 2026 is 00:30 BST on 30 Mar
    expect(localDate(new Date('2026-03-29T23:30:00Z'))).toBe('2026-03-30')
    // 23:30 UTC on 25 Oct 2026 is still 23:30 GMT (clocks went back at 01:00 UTC)
    expect(localDate(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-25')
    expect(weekDates('2026-11-04')[0]).toBe('2026-11-02')
  })
})
