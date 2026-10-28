import { z } from 'zod'
import { db } from '@/data/db'
import { create, getUserId, isSyncEnabled, list } from '@/data/repo'
import { SYNCED_TABLES, type Row, type SyncedTable } from '@/data/types'
import { nowIso } from '@/lib/dates'
import { photoUrl, photos as listPhotos } from './photos'

export const EXPORT_SCHEMA_VERSION = 1

export async function exportAll() {
  const tables: Partial<Record<SyncedTable, Row[]>> = {}
  for (const t of SYNCED_TABLES) tables[t] = await list(t)
  return { app: 'my-fitness-365', schema_version: EXPORT_SCHEMA_VERSION, exported_at: nowIso(), tables }
}

const exportSchema = z.object({
  app: z.literal('my-fitness-365'),
  schema_version: z.number().int(),
  exported_at: z.string(),
  tables: z.record(z.string(), z.array(z.object({ id: z.string().uuid().or(z.string().min(1)) }).passthrough())),
  photos: z.record(z.string(), z.string()).optional(),
})

/**
 * Import a JSON export. Rejects unknown schema versions; rows whose id already
 * exists locally are skipped (never duplicated or overwritten).
 */
export async function importAll(json: unknown) {
  const parsed = exportSchema.safeParse(json)
  if (!parsed.success) throw new Error('This file is not a My Fitness 365 export.')
  if (parsed.data.schema_version > EXPORT_SCHEMA_VERSION) throw new Error(`Export version ${parsed.data.schema_version} is newer than this app supports.`)
  let added = 0
  let skipped = 0
  for (const t of SYNCED_TABLES) {
    if (t === 'profiles' || t === 'user_settings') continue // keep the current profile/settings
    for (const raw of parsed.data.tables[t] ?? []) {
      if (await db.table(t).get(raw.id)) {
        skipped++
        continue
      }
      const { user_id: _u, created_at, updated_at: _up, deleted_at, ...rest } = raw as unknown as Row
      if (deleted_at) continue
      if (t === 'progress_photos') {
        const data = parsed.data.photos?.[raw.id]
        if (!data) {
          skipped++
          continue
        }
        const blob = await (await fetch(data)).blob()
        await db.blobs.put({ id: raw.id, user_id: getUserId(), blob, created_at: nowIso() })
        Object.assign(rest, { storage: isSyncEnabled() ? 'cloud' : 'local', storage_path: null, uploaded: false })
      }
      await create(t, { ...(rest as object), created_at } as never)
      added++
    }
  }
  return { added, skipped }
}

/** Photo backup: JSON export plus every photo embedded as a data URL. */
export async function exportWithPhotos() {
  const data = await exportAll()
  const photos: Record<string, string> = {}
  for (const p of await listPhotos()) {
    const url = await photoUrl(p)
    if (!url) continue
    const blob = await (await fetch(url)).blob()
    photos[p.id] = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.readAsDataURL(blob)
    })
  }
  return { ...data, photos }
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCsv = (rows: Record<string, unknown>[], cols: string[]) =>
  [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')

export async function csvExports() {
  const [weights, measures, sessions, sets, exercises, food, drinks, rides] = await Promise.all([
    list('weight_entries'),
    list('body_measurements'),
    list('workout_sessions'),
    list('workout_sets'),
    list('exercises'),
    list('food_log_entries'),
    list('alcohol_entries'),
    list('cycling_sessions'),
  ])
  const exName = new Map(exercises.map((e) => [e.id, e.name]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  return {
    'weight.csv': toCsv([...weights].sort((a, b) => a.date.localeCompare(b.date)) as never, ['date', 'weight_kg', 'notes']),
    'measurements.csv': toCsv([...measures].sort((a, b) => a.date.localeCompare(b.date)) as never, ['date', 'type', 'value', 'entered_unit', 'notes']),
    'workouts.csv': toCsv(
      sets
        .filter((s) => sessionById.get(s.session_id)?.status === 'completed')
        .map((s) => ({ date: sessionById.get(s.session_id)!.date, workout: sessionById.get(s.session_id)!.name, exercise: exName.get(s.exercise_id), set: s.set_number, weight_kg: s.weight_kg, reps: s.reps, seconds: s.seconds, completed: s.completed }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      ['date', 'workout', 'exercise', 'set', 'weight_kg', 'reps', 'seconds', 'completed'],
    ),
    'nutrition.csv': toCsv([...food].sort((a, b) => a.date.localeCompare(b.date)) as never, ['date', 'slot', 'name', 'portions', 'kcal', 'protein', 'carbs', 'fat', 'fibre', 'during_ride']),
    'alcohol.csv': toCsv([...drinks].sort((a, b) => a.date.localeCompare(b.date)) as never, ['date', 'drink_type', 'volume_ml', 'abv', 'quantity', 'mixer', 'mixer_kcal']),
    'rides.csv': toCsv([...rides].sort((a, b) => a.date.localeCompare(b.date)) as never, ['date', 'start_time', 'duration_min', 'distance_km', 'elevation_m', 'est_kcal', 'intensity', 'rpe', 'completed', 'notes']),
  }
}

export function downloadFile(name: string, content: string | Blob, type = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Wipe every local record for every user on this device (sign-out / delete). */
export async function wipeLocalData() {
  await Promise.all(db.tables.map((t) => t.clear()))
}
