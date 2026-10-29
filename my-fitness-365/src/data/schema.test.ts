import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabase, db } from './db'
import { setSession, list } from './repo'
import { seedUser } from './seed'
import { SYNCED_TABLES } from './types'
import * as diary from '@/services/diary'
import * as workouts from '@/services/workouts'
import * as meals from '@/services/meals'
import * as body from '@/services/body'
import * as rides from '@/services/rides'

/** Parse `create table public.x ( ... );` column names from the migrations. */
function sqlColumns() {
  const dir = join(__dirname, '../../supabase/migrations')
  const sql = readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
  const out = new Map<string, Set<string>>()
  for (const m of sql.matchAll(/create table public\.(\w+) \(([\s\S]*?)\n\);/g)) {
    const cols = new Set<string>()
    for (const part of m[2].split(/,\s*\n|,\s+(?=[a-z_]+ (?:uuid|text|int|numeric|boolean|date|timestamptz|jsonb))/)) {
      const name = part.trim().split(/\s+/)[0]
      if (name) cols.add(name)
    }
    out.set(m[1], cols)
  }
  for (const m of sql.matchAll(/alter table public\.(\w+)([\s\S]*?);/g)) {
    for (const c of m[2].matchAll(/add column (\w+)/g)) out.get(m[1])?.add(c[1])
  }
  return out
}

describe('local rows match the Supabase schema', () => {
  it('every synced table exists in the migration and every field is a column', async () => {
    openDatabase(`schema-${Math.random()}`)
    setSession('schema-user', false)
    await seedUser('schema-user')
    // Exercise the services so every table has realistic rows
    const [mon] = await diary.getDayPlan('2026-11-02')
    await diary.rescheduleActivity(mon, '2026-11-03')
    await diary.updateDiary('2026-11-02', { notes: 'x', energy: 3 })
    const t = (await list('workout_templates'))[0]
    const s = await workouts.startSession(t.id, '2026-11-04')
    await workouts.finishSession(s)
    await meals.suggestDay('2026-11-02')
    await meals.logPlannedMeal((await meals.plannedMeals('2026-11-02'))[0])
    await meals.logCustomFood('2026-11-02', 'ride', { name: 'Gel', kcal: 90, protein: 0, carbs: 22, fat: 0 })
    await meals.logDrink('2026-11-05', { drink_type: 'Rum', volume_ml: 50, abv: 40, quantity: 2, mixer: 'Diet Coke', mixer_kcal: 1 })
    await meals.generateShoppingList('2026-11-02', '2026-11-08')
    await body.addWeight('2026-11-02', 88)
    await body.addMeasurements('2026-11-02', { waist_navel: 100 }, 'cm')
    await rides.recordRide({ date: '2026-11-02', start_time: null, duration_min: 60, distance_km: 20, elevation_m: null, est_kcal: 500, intensity: 'moderate', rpe: 6, notes: '', completed: true })
    const { create } = await import('./repo')
    await create('progress_photos', { date: '2026-11-02', view: 'front', storage: 'local', storage_path: null, width: 10, height: 10, mime: 'image/jpeg', notes: '', uploaded: false })
    await create('notifications', { kind: 'general', title: 't', body: '', due_date: '2026-11-02', dismissed_at: null })
    await create('exercise_media', { exercise_id: (await list('exercises'))[0].id, kind: 'image', label: 'start', storage: 'local', url: null, source: 'x' })

    const cols = sqlColumns()
    // Guard the parser itself
    expect(cols.get('profiles')!.has('weight_unit')).toBe(true)
    expect(cols.get('workout_sets')!.has('completed_at')).toBe(true)
    expect(cols.get('profiles')!.has('not_a_column')).toBe(false)
    for (const table of SYNCED_TABLES) {
      expect(cols.has(table), `table ${table} in migration`).toBe(true)
      const rows = await db.table(table).toArray()
      expect(rows.length, `rows in ${table}`).toBeGreaterThan(0)
      for (const row of rows) for (const key of Object.keys(row)) expect(cols.get(table)!.has(key), `${table}.${key} column`).toBe(true)
    }
  })
})
