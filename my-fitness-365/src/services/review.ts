import { list } from '@/data/repo'
import { shiftDate } from '@/lib/dates'
import type { BodyMeasurement, MeasurementType } from '@/data/types'
import { exerciseHistory } from './workouts'

export interface RangeSummary {
  start: string
  end: string
  weight: { first: number; last: number; change: number; firstDate: string; lastDate: string; entries: number } | null
  measures: Partial<Record<MeasurementType, { first: number; last: number; change: number; entries: number }>>
  workoutsCompleted: number
  workoutsPlanned: number
  strength: { name: string; from: number; to: number }[]
  rides: { count: number; minutes: number; km: number }
  nutrition: { daysLogged: number; avgKcal: number | null; avgProtein: number | null }
  photosCaptured: number
  missing: string[]
}

/** Summarise only what was actually recorded between two dates (inclusive). Never fills gaps. */
export async function summariseRange(start: string, end: string): Promise<RangeSummary> {
  const [weights, measures, sessions, scheduled, rides, food, photos, exercises] = await Promise.all([
    list('weight_entries'),
    list('body_measurements'),
    list('workout_sessions'),
    list('scheduled_activities'),
    list('cycling_sessions'),
    list('food_log_entries'),
    list('progress_photos'),
    list('exercises'),
  ])
  const inR = (d: string) => d >= start && d <= end
  const missing: string[] = []

  const w = weights.filter((x) => inR(x.date)).sort((a, b) => a.date.localeCompare(b.date))
  const weight = w.length >= 1 ? { first: w[0].weight_kg, last: w.at(-1)!.weight_kg, change: w.at(-1)!.weight_kg - w[0].weight_kg, firstDate: w[0].date, lastDate: w.at(-1)!.date, entries: w.length } : null
  if (!weight) missing.push('No weigh-ins in this period.')
  else if (w.length === 1) missing.push('Only one weigh-in, so no weight change can be calculated.')

  const m: RangeSummary['measures'] = {}
  for (const t of ['waist_navel', 'chest', 'shoulders'] as MeasurementType[]) {
    const rows = measures.filter((x: BodyMeasurement) => x.type === t && inR(x.date)).sort((a, b) => a.date.localeCompare(b.date))
    if (rows.length) m[t] = { first: rows[0].value, last: rows.at(-1)!.value, change: rows.at(-1)!.value - rows[0].value, entries: rows.length }
    else missing.push(`No ${t === 'waist_navel' ? 'waist' : t} measurements in this period.`)
  }

  const done = sessions.filter((s) => s.status === 'completed' && inR(s.date))
  const planned = scheduled.filter((s) => inR(s.date) && (s.kind === 'workout' || s.kind === 'combined') && s.status !== 'cancelled')

  const strength: RangeSummary['strength'] = []
  const exIds = new Set((await list('workout_sets')).filter((s) => done.some((d) => d.id === s.session_id)).map((s) => s.exercise_id))
  for (const id of exIds) {
    const h = (await exerciseHistory(id)).filter((x) => inR(x.date))
    if (h.length >= 2 && h.at(-1)!.topWeight !== h[0].topWeight) strength.push({ name: exercises.find((e) => e.id === id)?.name ?? 'Exercise', from: h[0].topWeight, to: h.at(-1)!.topWeight })
  }

  const r = rides.filter((x) => x.completed && inR(x.date))
  const f = food.filter((x) => inR(x.date))
  const days = [...new Set(f.map((x) => x.date))]
  const nutrition = {
    daysLogged: days.length,
    avgKcal: days.length ? f.reduce((s, x) => s + x.kcal, 0) / days.length : null,
    avgProtein: days.length ? f.reduce((s, x) => s + x.protein, 0) / days.length : null,
  }
  if (!days.length) missing.push('No food logged in this period.')

  return {
    start,
    end,
    weight,
    measures: m,
    workoutsCompleted: done.length,
    workoutsPlanned: planned.length,
    strength,
    rides: { count: r.length, minutes: r.reduce((s, x) => s + x.duration_min, 0), km: r.reduce((s, x) => s + (x.distance_km ?? 0), 0) },
    nutrition,
    photosCaptured: photos.filter((p) => inR(p.date)).length,
    missing,
  }
}

export const RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '12m', label: '12 months', days: 365 },
  { key: 'all', label: 'All', days: 36500 },
] as const
export type RangeKey = (typeof RANGES)[number]['key']
export const rangeStart = (end: string, key: RangeKey) => shiftDate(end, -(RANGES.find((r) => r.key === key)!.days - 1))
