import { db } from '@/data/db'
import { create, forDate, getUserId, list, update } from '@/data/repo'
import { weekday } from '@/lib/dates'
import type { ActivityStatus, ActivityTemplate, DiaryEntry, ScheduledActivity } from '@/data/types'
import { getSettings } from './profile'

export interface PlanItem extends ScheduledActivity {
  /** True when this item comes from the weekly default and has not been stored yet. */
  virtual: boolean
}

export async function getDiaryEntry(date: string): Promise<DiaryEntry | undefined> {
  const rows = await db.diary_entries.where('[user_id+date]').equals([getUserId(), date]).toArray()
  return rows.find((r) => !r.deleted_at)
}

export async function ensureDiaryEntry(date: string): Promise<DiaryEntry> {
  return (
    (await getDiaryEntry(date)) ??
    create('diary_entries', {
      date,
      notes: '',
      energy: null,
      mood: null,
      sleep_hours: null,
      plan_materialised: false,
      day_type_override: null,
    })
  )
}

export async function updateDiary(date: string, patch: Partial<DiaryEntry>) {
  const entry = await ensureDiaryEntry(date)
  return update('diary_entries', entry.id, patch)
}

function fromTemplate(date: string, t: ActivityTemplate, position: number) {
  return {
    date,
    template_id: t.id,
    title: t.name,
    kind: t.kind,
    workout_template_id: t.workout_template_id,
    ride_intensity: t.ride_intensity,
    status: 'planned' as ActivityStatus,
    workout_session_id: null,
    cycling_session_id: null,
    rescheduled_from: null,
    notes: '',
    position,
  }
}

async function defaultRaw(date: string) {
  const [settings, templates] = await Promise.all([getSettings(), list('activity_templates')])
  const keys = settings?.weekly_schedule[String(weekday(date))] ?? []
  return keys
    .map((k) => templates.find((t) => t.key === k))
    .filter((t): t is ActivityTemplate => Boolean(t))
    .map((t, i) => fromTemplate(date, t, i))
}

async function defaultItems(date: string): Promise<PlanItem[]> {
  return (await defaultRaw(date)).map((raw, i) => ({
      ...raw,
      id: `virtual:${date}:${i}`,
      user_id: getUserId(),
      created_at: '',
      updated_at: '',
      deleted_at: null,
      virtual: true,
    }))
}

/** The plan for a date: stored activities once customised, otherwise the weekly default. */
export async function getDayPlan(date: string): Promise<PlanItem[]> {
  const entry = await getDiaryEntry(date)
  if (!entry?.plan_materialised) return defaultItems(date)
  const rows = await forDate('scheduled_activities', date)
  return rows
    .filter((r) => r.user_id === getUserId())
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ ...r, virtual: false }))
}

/** Store the default plan for a date so it can be edited without affecting other days. */
export async function materialiseDay(date: string): Promise<ScheduledActivity[]> {
  const entry = await ensureDiaryEntry(date)
  if (!entry.plan_materialised) {
    for (const raw of await defaultRaw(date)) await create('scheduled_activities', raw)
    await update('diary_entries', entry.id, { plan_materialised: true })
  }
  return (await forDate('scheduled_activities', date)).sort((a, b) => a.position - b.position)
}

/** Resolve a (possibly virtual) plan item to a stored activity. */
export async function resolveItem(item: PlanItem | ScheduledActivity): Promise<ScheduledActivity> {
  if (!('virtual' in item) || !item.virtual) return item
  const stored = await materialiseDay(item.date)
  const found = stored.find((s) => s.position === item.position && s.template_id === item.template_id)
  if (!found) throw new Error('Could not resolve planned activity')
  return found
}

export async function addActivity(date: string, template: ActivityTemplate) {
  const stored = await materialiseDay(date)
  const position = stored.reduce((m, s) => Math.max(m, s.position + 1), 0)
  return create('scheduled_activities', fromTemplate(date, template, position))
}

export async function setActivityStatus(item: PlanItem | ScheduledActivity, status: ActivityStatus) {
  const a = await resolveItem(item)
  return update('scheduled_activities', a.id, { status })
}

export async function setActivityNotes(item: PlanItem | ScheduledActivity, notes: string) {
  const a = await resolveItem(item)
  return update('scheduled_activities', a.id, { notes })
}

/**
 * Remove a planned item from a day. Completed items are kept (history is never
 * erased); others are marked cancelled so the change is visible in the diary.
 */
export async function removeActivity(item: PlanItem | ScheduledActivity) {
  const a = await resolveItem(item)
  if (a.status === 'completed') throw new Error('Completed activities are kept in your history')
  return update('scheduled_activities', a.id, { status: 'cancelled' })
}

/** Move an activity to another date. The original stays as a cancelled record noting the move. */
export async function rescheduleActivity(item: PlanItem | ScheduledActivity, toDate: string) {
  const a = await resolveItem(item)
  if (a.status === 'completed') throw new Error('Completed activities cannot be moved')
  const target = await materialiseDay(toDate)
  const position = target.reduce((m, s) => Math.max(m, s.position + 1), 0)
  const moved = await create('scheduled_activities', {
    date: toDate,
    template_id: a.template_id,
    title: a.title,
    kind: a.kind,
    workout_template_id: a.workout_template_id,
    ride_intensity: a.ride_intensity,
    status: 'planned',
    workout_session_id: null,
    cycling_session_id: null,
    rescheduled_from: a.date,
    notes: a.notes,
    position,
  })
  await update('scheduled_activities', a.id, { status: 'cancelled', notes: `Moved to ${toDate}${a.notes ? ` — ${a.notes}` : ''}` })
  return moved
}

/** Copy the planned (non-cancelled) items from one date onto another. Existing items stay. */
export async function copyItinerary(fromDate: string, toDate: string) {
  const source = (await getDayPlan(fromDate)).filter((s) => s.status !== 'cancelled')
  const target = await materialiseDay(toDate)
  let position = target.reduce((m, s) => Math.max(m, s.position + 1), 0)
  for (const s of source) {
    await create('scheduled_activities', {
      date: toDate,
      template_id: s.template_id,
      title: s.title,
      kind: s.kind,
      workout_template_id: s.workout_template_id,
      ride_intensity: s.ride_intensity,
      status: 'planned',
      workout_session_id: null,
      cycling_session_id: null,
      rescheduled_from: null,
      notes: '',
      position: position++,
    })
  }
}
