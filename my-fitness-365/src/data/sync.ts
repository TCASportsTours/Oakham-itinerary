import { db } from './db'
import { getUserId, isSyncEnabled } from './repo'
import { supabase, PHOTO_BUCKET } from './supabase'
import type { ProgressPhoto, Row, SyncedTable } from './types'

/**
 * Push order respects foreign keys (parents before children).
 * Conflict policy (single user, few devices):
 *  - Every row has a stable client-generated UUID, so pushes are idempotent upserts.
 *  - Last write wins per row; the server stamps updated_at.
 *  - A pending local edit is kept over an incoming remote edit, EXCEPT a remote
 *    deletion (tombstone), which always wins.
 *  - Seeded rows are pushed with ignoreDuplicates so they never overwrite a
 *    server copy the user edited on another device.
 */
export const PUSH_ORDER: SyncedTable[] = [
  'profiles',
  'user_settings',
  'exercises',
  'exercise_media',
  'workout_templates',
  'workout_template_exercises',
  'activity_templates',
  'ingredients',
  'recipes',
  'recipe_ingredients',
  'scheduled_activities',
  'diary_entries',
  'workout_sessions',
  'workout_sets',
  'cycling_sessions',
  'planned_meals',
  'food_log_entries',
  'alcohol_entries',
  'shopping_lists',
  'shopping_list_items',
  'weight_entries',
  'body_measurements',
  'progress_photos',
  'notifications',
]

export interface SyncResult {
  pushed: number
  pulled: number
  failed: number
  pending: number
}

let running: Promise<SyncResult> | null = null

/** Supabase returns plain error objects (not Error instances) — keep their message. */
export function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return String(e)
}

export const pendingCount = () => db.sync_operations.count()

export function syncNow(): Promise<SyncResult> {
  if (!supabase || !isSyncEnabled()) return Promise.resolve({ pushed: 0, pulled: 0, failed: 0, pending: 0 })
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return pendingCount().then((pending) => ({ pushed: 0, pulled: 0, failed: 0, pending }))
  }
  running ??= (async () => {
    try {
      const pushed = await push()
      const pulled = await pull()
      return { ...pushed, pulled, pending: await pendingCount() }
    } finally {
      running = null
    }
  })()
  return running
}

async function uploadPhoto(row: ProgressPhoto): Promise<ProgressPhoto> {
  if (row.storage !== 'cloud' || row.uploaded || row.deleted_at) return row
  const blob = await db.blobs.get(row.id)
  if (!blob) throw new Error('Photo file missing on this device')
  const path = `${getUserId()}/${row.id}.jpg`
  const { error } = await supabase!.storage.from(PHOTO_BUCKET).upload(path, blob.blob, { contentType: row.mime, upsert: true })
  if (error) throw error
  const next = { ...row, storage_path: path, uploaded: true }
  await db.progress_photos.put(next)
  return next
}

async function push() {
  const ops = await db.sync_operations.orderBy('created_at').toArray()
  let pushed = 0
  let failed = 0
  // Collapse to the latest state of each record; seed flag survives only if all ops were seeds.
  const byRecord = new Map<string, { table: SyncedTable; seed: boolean; opIds: string[] }>()
  for (const op of ops) {
    const k = `${op.table}:${op.record_id}`
    const cur = byRecord.get(k)
    byRecord.set(k, { table: op.table, seed: (cur?.seed ?? true) && op.seed, opIds: [...(cur?.opIds ?? []), op.id] })
  }
  for (const table of PUSH_ORDER) {
    const entries = [...byRecord.entries()].filter(([, v]) => v.table === table)
    for (const [key, info] of entries) {
      const id = key.slice(table.length + 1)
      try {
        let row = (await db.table(table).get(id)) as Row | undefined
        if (!row) {
          await db.sync_operations.bulkDelete(info.opIds)
          continue
        }
        if (table === 'progress_photos') {
          const photo = row as ProgressPhoto
          if (photo.deleted_at) {
            // Photos are removed for real: file and metadata together.
            if (photo.storage_path) {
              const { error } = await supabase!.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
              if (error) throw error
            }
            const { error } = await supabase!.from('progress_photos').delete().eq('id', id)
            if (error) throw error
            await db.progress_photos.delete(id)
            await db.blobs.delete(id)
            await db.sync_operations.bulkDelete(info.opIds)
            pushed++
            continue
          }
          row = await uploadPhoto(photo)
          await db.blobs.delete(id) // keep as little sensitive data on-device as possible
        }
        const { error } = await supabase!.from(table).upsert(row, { onConflict: 'id', ignoreDuplicates: info.seed })
        if (error) throw error
        await db.sync_operations.bulkDelete(info.opIds)
        pushed++
      } catch (e) {
        failed++
        const message = errorMessage(e)
        await db.sync_operations.where('id').anyOf(info.opIds).modify((op) => {
          op.attempts += 1
          op.last_error = message
        })
      }
    }
  }
  return { pushed, failed }
}

async function pull() {
  let pulled = 0
  const pending = new Set((await db.sync_operations.toArray()).map((o) => `${o.table}:${o.record_id}`))
  for (const table of PUSH_ORDER) {
    const cursorKey = `cursor:${getUserId()}:${table}`
    let cursor = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? '1970-01-01T00:00:00Z'
    for (;;) {
      const { data, error } = await supabase!.from(table).select('*').gt('updated_at', cursor).order('updated_at').limit(500)
      if (error) throw error
      if (!data?.length) break
      for (const remote of data as Row[]) {
        const k = `${table}:${remote.id}`
        if (pending.has(k) && !remote.deleted_at) continue
        if (pending.has(k)) await db.sync_operations.where('record_id').equals(remote.id).delete()
        await db.table(table).put(remote)
        pulled++
      }
      cursor = (data.at(-1) as Row).updated_at
      await db.meta.put({ key: cursorKey, value: cursor })
      if (data.length < 500) break
    }
  }
  return pulled
}

/** Keep sync running opportunistically; iOS does not offer reliable background sync. */
export function startAutoSync(onDone?: (r: SyncResult) => void) {
  const run = () => syncNow().then(onDone).catch(() => undefined)
  window.addEventListener('online', run)
  const onVisible = () => document.visibilityState === 'visible' && run()
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(run, 60_000)
  run()
  return () => {
    window.removeEventListener('online', run)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
