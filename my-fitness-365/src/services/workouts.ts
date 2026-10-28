import { db } from '@/data/db'
import { create, get, getUserId, list, update, where } from '@/data/repo'
import { nowIso } from '@/lib/dates'
import type { Exercise, WorkoutSession, WorkoutSet, WorkoutTemplate, WorkoutTemplateExercise } from '@/data/types'
import { materialiseDay, resolveItem, type PlanItem } from './diary'

export interface TemplateDetail {
  template: WorkoutTemplate
  items: { te: WorkoutTemplateExercise; exercise: Exercise }[]
}

export async function getTemplateDetail(templateId: string): Promise<TemplateDetail | undefined> {
  const template = await get('workout_templates', templateId)
  if (!template) return undefined
  const tes = (await where('workout_template_exercises', 'template_id', templateId)).sort((a, b) => a.position - b.position)
  const exercises = await list('exercises')
  const items = tes
    .map((te) => ({ te, exercise: exercises.find((e) => e.id === te.exercise_id)! }))
    .filter((x) => x.exercise)
  return { template, items }
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  const rows = await db.workout_sessions.where('status').equals('in_progress').toArray()
  return rows.filter((r) => r.user_id === getUserId() && !r.deleted_at).sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
}

/** Start (or resume, if one is already running for this template) a workout session. */
export async function startSession(templateId: string, date: string, plan?: PlanItem) {
  const active = await getActiveSession()
  if (active && active.template_id === templateId) return active
  const detail = await getTemplateDetail(templateId)
  if (!detail) throw new Error('Workout template not found')
  let scheduledId: string | null = null
  if (plan) scheduledId = (await resolveItem(plan)).id
  else {
    const day = await materialiseDay(date)
    scheduledId = day.find((d) => d.workout_template_id === templateId && d.status === 'planned')?.id ?? null
  }
  const session = await create('workout_sessions', {
    date,
    template_id: templateId,
    name: detail.template.name,
    status: 'in_progress',
    started_at: nowIso(),
    finished_at: null,
    current_index: 0,
    scheduled_activity_id: scheduledId,
    skipped_exercise_ids: [],
    notes: '',
  })
  // Pre-create planned set rows, pre-filled with the last weight used for each exercise.
  for (const { te, exercise } of detail.items) {
    const prev = await previousPerformance(exercise.id, session.id)
    for (let n = 1; n <= te.sets; n++) {
      const last = prev?.sets.find((s) => s.set_number === n) ?? prev?.sets.at(-1)
      await create('workout_sets', {
        session_id: session.id,
        exercise_id: exercise.id,
        set_number: n,
        weight_kg: last?.weight_kg ?? null,
        reps: te.rep_unit === 'reps' ? (last?.reps ?? te.reps_max) : null,
        seconds: te.rep_unit === 'seconds' ? (last?.seconds ?? te.reps_min) : null,
        completed: false,
        completed_at: null,
      })
    }
  }
  if (scheduledId) await update('scheduled_activities', scheduledId, { workout_session_id: session.id })
  return session
}

export async function getSessionSets(sessionId: string): Promise<WorkoutSet[]> {
  return (await where('workout_sets', 'session_id', sessionId)).sort((a, b) => a.set_number - b.set_number)
}

export const updateSet = (id: string, patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'seconds'>>) =>
  update('workout_sets', id, patch)

export const toggleSetComplete = (set: WorkoutSet) =>
  update('workout_sets', set.id, { completed: !set.completed, completed_at: set.completed ? null : nowIso() })

export async function addSet(sessionId: string, exerciseId: string) {
  const sets = (await getSessionSets(sessionId)).filter((s) => s.exercise_id === exerciseId)
  const last = sets.at(-1)
  return create('workout_sets', {
    session_id: sessionId,
    exercise_id: exerciseId,
    set_number: (last?.set_number ?? 0) + 1,
    weight_kg: last?.weight_kg ?? null,
    reps: last?.reps ?? null,
    seconds: last?.seconds ?? null,
    completed: false,
    completed_at: null,
  })
}

export const setCurrentIndex = (sessionId: string, current_index: number) =>
  update('workout_sessions', sessionId, { current_index })

export async function skipExercise(session: WorkoutSession, exerciseId: string) {
  const skipped = new Set(session.skipped_exercise_ids)
  skipped.has(exerciseId) ? skipped.delete(exerciseId) : skipped.add(exerciseId)
  return update('workout_sessions', session.id, { skipped_exercise_ids: [...skipped] })
}

export async function finishSession(session: WorkoutSession, notes = '') {
  const done = await update('workout_sessions', session.id, { status: 'completed', finished_at: nowIso(), notes })
  if (session.scheduled_activity_id) {
    await update('scheduled_activities', session.scheduled_activity_id, { status: 'completed', workout_session_id: session.id })
  }
  return done
}

export async function abandonSession(session: WorkoutSession) {
  return update('workout_sessions', session.id, { status: 'abandoned', finished_at: nowIso() })
}

export async function completedSessions(): Promise<WorkoutSession[]> {
  return (await list('workout_sessions')).filter((s) => s.status === 'completed').sort((a, b) => b.started_at.localeCompare(a.started_at))
}

/** Last completed session's completed sets for an exercise (excluding `excludeSessionId`). */
export async function previousPerformance(exerciseId: string, excludeSessionId?: string) {
  const sessions = (await completedSessions()).filter((s) => s.id !== excludeSessionId)
  const sets = (await where('workout_sets', 'exercise_id', exerciseId)).filter((s) => s.completed)
  for (const s of sessions) {
    const mine = sets.filter((x) => x.session_id === s.id).sort((a, b) => a.set_number - b.set_number)
    if (mine.length) return { session: s, sets: mine }
  }
  return undefined
}

/** Per-session best set for an exercise, oldest first (for strength charts). */
export async function exerciseHistory(exerciseId: string) {
  const sessions = await completedSessions()
  const sets = (await where('workout_sets', 'exercise_id', exerciseId)).filter((s) => s.completed)
  return sessions
    .map((s) => {
      const mine = sets.filter((x) => x.session_id === s.id)
      if (!mine.length) return null
      const topWeight = Math.max(...mine.map((x) => x.weight_kg ?? 0))
      const volume = mine.reduce((t, x) => t + (x.weight_kg ?? 0) * (x.reps ?? 0), 0)
      const best = mine.reduce((b, x) => ((x.weight_kg ?? 0) > (b.weight_kg ?? 0) ? x : b), mine[0])
      return { date: s.date, sessionId: s.id, topWeight, volume, bestReps: best.reps, sets: mine }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .reverse()
}
