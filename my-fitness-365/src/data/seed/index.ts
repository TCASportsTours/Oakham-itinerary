import { db } from '../db'
import { getUserId, isSyncEnabled, newId, seedId } from '../repo'
import { nowIso, today } from '@/lib/dates'
import type { Row, SyncedTable, SyncOperation } from '../types'
import { EXERCISES, VERIFIED_VIDEOS } from './exercises'
import { WORKOUTS, WARMUP } from './workouts'
import { ACTIVITY_TEMPLATES, DEFAULT_WEEKLY_SCHEDULE } from './activities'
import { INGREDIENTS, INGREDIENT_SOURCE } from './ingredients'
import { RECIPES } from './recipes'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from './profile'

export const SEED_VERSION = 1

/**
 * Seeds the user's editable copies of reference data. IDs are deterministic
 * (uuid v5 of user + key) and existing rows are never overwritten, so this is
 * safe to run repeatedly and on several devices.
 */
export async function seedUser(userId = getUserId()) {
  const metaKey = `seeded:${userId}`
  const done = await db.meta.get(metaKey)
  if (done && (done.value as number) >= SEED_VERSION) return false

  const ts = nowIso()
  const base = (key: string) => ({
    id: seedId(userId, key),
    user_id: userId,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  })
  const rows: Partial<Record<SyncedTable, Row[]>> = {}
  const add = (t: SyncedTable, row: Row) => (rows[t] ??= []).push(row)

  add('profiles', { ...base('profile'), ...DEFAULT_PROFILE(today()) } as Row)
  add('user_settings', { ...base('settings'), ...DEFAULT_SETTINGS(DEFAULT_WEEKLY_SCHEDULE) } as Row)

  for (const e of EXERCISES) {
    const v = VERIFIED_VIDEOS[e.key]
    add('exercises', {
      ...base(`exercise:${e.key}`),
      ...e,
      video_url: v?.url ?? null,
      video_source: v?.source ?? null,
      video_verified: Boolean(v),
    } as Row)
  }
  const exId = (k: string) => seedId(userId, `exercise:${k}`)

  for (const w of WORKOUTS) {
    const tid = seedId(userId, `workout:${w.key}`)
    add('workout_templates', {
      ...base(`workout:${w.key}`),
      key: w.key,
      name: w.name,
      focus: w.focus,
      default_weekday: w.default_weekday,
      duration_text: w.duration_text,
      warmup: WARMUP,
      notes: '',
    } as Row)
    w.exercises.forEach((te, idx) =>
      add('workout_template_exercises', {
        ...base(`wte:${w.key}:${idx}`),
        template_id: tid,
        exercise_id: exId(te.exercise),
        position: idx,
        sets: te.sets,
        reps_min: te.reps_min,
        reps_max: te.reps_max,
        rep_unit: te.rep_unit,
        per_side: te.per_side,
        suggested_weight: te.suggested_weight,
        rest_seconds: te.rest_seconds,
      } as Row),
    )
  }

  for (const a of ACTIVITY_TEMPLATES) {
    add('activity_templates', {
      ...base(`activity:${a.key}`),
      key: a.key,
      name: a.name,
      kind: a.kind,
      workout_template_id: a.workout ? seedId(userId, `workout:${a.workout}`) : null,
      ride_intensity: a.ride_intensity ?? null,
      duration_min: a.duration_min ?? null,
      description: a.description,
    } as Row)
  }

  for (const ing of INGREDIENTS) add('ingredients', { ...base(`ing:${ing.key}`), ...ing, source: INGREDIENT_SOURCE } as Row)

  for (const rec of RECIPES) {
    const rid = seedId(userId, `recipe:${rec.key}`)
    add('recipes', {
      ...base(`recipe:${rec.key}`),
      key: rec.key,
      name: rec.name,
      meal_type: rec.meal_type,
      prep_min: rec.prep_min,
      cook_min: rec.cook_min,
      portions: rec.portions,
      instructions: rec.steps,
      tags: rec.tags,
      favourite: false,
      image_url: null,
      notes: '',
    } as Row)
    rec.ingredients.forEach(([ik, grams, note], idx) => {
      if (!INGREDIENTS.some((x) => x.key === ik)) throw new Error(`Recipe ${rec.key} uses unknown ingredient ${ik}`)
      add('recipe_ingredients', {
        ...base(`ri:${rec.key}:${idx}`),
        recipe_id: rid,
        ingredient_id: seedId(userId, `ing:${ik}`),
        grams,
        note: note ?? '',
        position: idx,
      } as Row)
    })
  }

  const tables = Object.keys(rows) as SyncedTable[]
  await db.transaction('rw', [...tables.map((t) => db.table(t)), db.sync_operations, db.meta], async () => {
    for (const t of tables) {
      const list = rows[t]!
      const existing = new Set(
        (await db.table(t).bulkGet(list.map((r) => r.id))).filter(Boolean).map((r: Row) => r.id),
      )
      const fresh = list.filter((r) => !existing.has(r.id))
      await db.table(t).bulkPut(fresh)
      if (isSyncEnabled()) {
        const ops: SyncOperation[] = fresh.map((r) => ({
          id: newId(),
          table: t,
          record_id: r.id,
          op: 'upsert',
          payload: r,
          seed: true,
          created_at: ts,
          attempts: 0,
          last_error: null,
        }))
        await db.sync_operations.bulkPut(ops)
      }
    }
    await db.meta.put({ key: metaKey, value: SEED_VERSION })
  })
  return true
}
