import { beforeEach, describe, expect, it, vi } from 'vitest'

/** In-memory stand-in for the Supabase client (tables + storage) — enough for the sync engine. */
const server = vi.hoisted(() => {
  const tables = new Map<string, Map<string, Record<string, unknown>>>()
  const objects = new Map<string, Blob>()
  const calls: { op: string; table: string; ignoreDuplicates?: boolean }[] = []
  let clock = 0
  let failTable: string | null = null
  const t = (name: string) => tables.get(name) ?? tables.set(name, new Map()).get(name)!
  const stamp = () => new Date(Date.UTC(2030, 0, 1) + ++clock * 1000).toISOString()
  const client = {
    from(table: string) {
      return {
        async upsert(row: Record<string, unknown>, opts: { ignoreDuplicates?: boolean } = {}) {
          calls.push({ op: 'upsert', table, ignoreDuplicates: opts.ignoreDuplicates })
          if (failTable === table) return { error: { message: 'boom' } }
          if (opts.ignoreDuplicates && t(table).has(row.id as string)) return { error: null }
          t(table).set(row.id as string, { ...row, updated_at: stamp() })
          return { error: null }
        },
        delete() {
          return {
            async eq(_c: string, id: string) {
              calls.push({ op: 'delete', table })
              t(table).delete(id)
              return { error: null }
            },
          }
        },
        select() {
          let cursor = ''
          const q = {
            gt(_c: string, v: string) {
              cursor = v
              return q
            },
            order() {
              return q
            },
            async limit(n: number) {
              const data = [...t(table).values()].filter((r) => (r.updated_at as string) > cursor).sort((a, b) => (a.updated_at as string).localeCompare(b.updated_at as string)).slice(0, n)
              return { data, error: null }
            },
          }
          return q
        },
      }
    },
    storage: {
      from() {
        return {
          async upload(path: string, blob: Blob) {
            objects.set(path, blob)
            return { error: null }
          },
          async remove(paths: string[]) {
            paths.forEach((p) => objects.delete(p))
            return { error: null }
          },
        }
      },
    },
  }
  return { tables, objects, calls, client, t, stamp, setFail: (x: string | null) => (failTable = x), reset: () => { tables.clear(); objects.clear(); calls.length = 0 } }
})

vi.mock('./supabase', () => ({ supabase: server.client, PHOTO_BUCKET: 'progress-photos' }))

import { openDatabase, db } from './db'
import { create, setSession, update, remove, list } from './repo'
import { syncNow, pendingCount } from './sync'
import { seedUser } from './seed'

const UID = 'aaaaaaaa-0000-4000-8000-000000000001'

beforeEach(async () => {
  server.reset()
  server.setFail(null)
  openDatabase(`sync-${Math.random()}`)
  setSession(UID, true)
})

describe('sync engine', () => {
  it('queues writes and pushes only the latest state of each record, once', async () => {
    const w = await create('weight_entries', { date: '2026-11-01', weight_kg: 88, notes: '' })
    await update('weight_entries', w.id, { weight_kg: 87.5 })
    expect(await pendingCount()).toBe(2)
    const r = await syncNow()
    expect(r.failed).toBe(0)
    expect(await pendingCount()).toBe(0)
    expect(server.calls.filter((c) => c.table === 'weight_entries' && c.op === 'upsert')).toHaveLength(1)
    expect(server.t('weight_entries').get(w.id)!.weight_kg).toBe(87.5)
  })

  it('pushes seeded rows with ignoreDuplicates so they never overwrite server edits', async () => {
    await seedUser(UID)
    await syncNow()
    const seeded = server.calls.filter((c) => c.table === 'recipes')
    expect(seeded.length).toBeGreaterThan(40)
    expect(seeded.every((c) => c.ignoreDuplicates)).toBe(true)
  })

  it('keeps failed operations queued with the error, and retries later', async () => {
    server.setFail('weight_entries')
    await create('weight_entries', { date: '2026-11-01', weight_kg: 88, notes: '' })
    const r = await syncNow()
    expect(r.failed).toBe(1)
    const [op] = await db.sync_operations.toArray()
    expect(op.attempts).toBe(1)
    expect(op.last_error).toBe('boom')
    server.setFail(null)
    expect((await syncNow()).failed).toBe(0)
    expect(await pendingCount()).toBe(0)
  })

  it('pulls remote rows; a pending local edit wins over a remote edit, but a remote deletion wins', async () => {
    const a = await create('weight_entries', { date: '2026-11-01', weight_kg: 88, notes: '' })
    const b = await create('weight_entries', { date: '2026-11-02', weight_kg: 87, notes: '' })
    await syncNow()
    // Another device edits A and deletes B
    server.t('weight_entries').set(a.id, { ...server.t('weight_entries').get(a.id)!, weight_kg: 90, updated_at: server.stamp() })
    server.t('weight_entries').set(b.id, { ...server.t('weight_entries').get(b.id)!, deleted_at: '2030-01-02T00:00:00Z', updated_at: server.stamp() })
    // Meanwhile this device edits both while offline
    await update('weight_entries', a.id, { weight_kg: 86 })
    await update('weight_entries', b.id, { notes: 'local' })
    // Pull before push: simulate by pulling only
    const { syncNow: run } = await import('./sync')
    server.setFail('weight_entries') // block the push so the pull decides
    await run()
    expect((await db.weight_entries.get(a.id))!.weight_kg).toBe(86) // local pending edit kept
    expect((await db.weight_entries.get(b.id))!.deleted_at).not.toBeNull() // remote deletion wins
    expect((await list('weight_entries')).map((w) => w.id)).toEqual([a.id])
  })

  it('a new device pulls existing data', async () => {
    server.t('weight_entries').set('11111111-0000-4000-8000-000000000009', { id: '11111111-0000-4000-8000-000000000009', user_id: UID, date: '2026-10-01', weight_kg: 89, notes: '', created_at: '2026-10-01T07:00:00Z', updated_at: server.stamp(), deleted_at: null })
    await syncNow()
    expect(await list('weight_entries')).toHaveLength(1)
  })

  it('uploads photo files privately, then removes the local copy; deleting removes file and metadata', async () => {
    const blob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' })
    const id = '22222222-0000-4000-8000-000000000001'
    await db.blobs.put({ id, user_id: UID, blob, created_at: '' })
    await create('progress_photos', { id, date: '2026-11-01', view: 'front', storage: 'cloud', storage_path: null, width: 3, height: 4, mime: 'image/jpeg', notes: '', uploaded: false })
    await syncNow()
    const path = `${UID}/${id}.jpg`
    expect(server.objects.has(path)).toBe(true)
    expect(server.t('progress_photos').get(id)).toMatchObject({ uploaded: true, storage_path: path })
    expect(await db.blobs.get(id)).toBeUndefined()

    await remove('progress_photos', id)
    await syncNow()
    expect(server.objects.has(path)).toBe(false)
    expect(server.t('progress_photos').has(id)).toBe(false)
    expect(await db.progress_photos.get(id)).toBeUndefined()
  })
})
