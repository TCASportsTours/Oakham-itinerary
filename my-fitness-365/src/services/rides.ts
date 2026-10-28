import { create, list, remove, update } from '@/data/repo'
import type { CyclingSession } from '@/data/types'
import { resolveItem, type PlanItem } from './diary'

export type RideInput = Omit<CyclingSession, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'scheduled_activity_id'>

export async function rides(): Promise<CyclingSession[]> {
  return (await list('cycling_sessions')).sort((a, b) => b.date.localeCompare(a.date))
}

export async function recordRide(input: RideInput, plan?: PlanItem) {
  const scheduled = plan ? await resolveItem(plan) : undefined
  const ride = await create('cycling_sessions', { ...input, scheduled_activity_id: scheduled?.id ?? null })
  if (scheduled && input.completed) {
    await update('scheduled_activities', scheduled.id, { status: 'completed', cycling_session_id: ride.id })
  }
  return ride
}

export const editRide = (id: string, patch: Partial<RideInput>) => update('cycling_sessions', id, patch)
export const deleteRide = (id: string) => remove('cycling_sessions', id)

export function weekTotals(all: CyclingSession[], start: string, end: string) {
  const inRange = all.filter((r) => r.completed && r.date >= start && r.date <= end)
  return {
    count: inRange.length,
    minutes: inRange.reduce((t, r) => t + r.duration_min, 0),
    km: inRange.reduce((t, r) => t + (r.distance_km ?? 0), 0),
    kcal: inRange.reduce((t, r) => t + (r.est_kcal ?? 0), 0),
  }
}
