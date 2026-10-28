import { v4 as uuidv4, v5 as uuidv5 } from 'uuid'
import { db } from './db'
import { nowIso } from '@/lib/dates'
import type { Row, SyncedTable, TableRowMap } from './types'

/**
 * All writes go through this module so every mutation is (a) stamped with the
 * owning user, (b) written to IndexedDB immediately and (c) queued for
 * Supabase in the same transaction when cloud sync is on.
 */

let currentUserId = 'local-user'
let syncEnabled = false
const listeners = new Set<() => void>()

export function setSession(userId: string, cloudSync: boolean) {
  currentUserId = userId
  syncEnabled = cloudSync
}
export const getUserId = () => currentUserId
export const isSyncEnabled = () => syncEnabled
export const onLocalWrite = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const newId = () => uuidv4()

const SEED_NAMESPACE = '6c1b3d5e-6f1a-4f5e-9a51-365f17e55365'
/** Deterministic per-user id for seeded records, so seeding is idempotent across devices. */
export const seedId = (userId: string, key: string) => uuidv5(`${userId}:${key}`, SEED_NAMESPACE)

export type NewRow<T extends Row> = Omit<T, keyof Row> & Partial<Pick<Row, 'id' | 'created_at'>>

function table<K extends SyncedTable>(name: K) {
  return db.table<TableRowMap[K], string>(name)
}

async function enqueue(name: SyncedTable, row: Row, seed = false) {
  if (!syncEnabled) return
  await db.sync_operations.put({
    id: newId(),
    table: name,
    record_id: row.id,
    op: 'upsert',
    payload: row,
    seed,
    created_at: nowIso(),
    attempts: 0,
    last_error: null,
  })
}

const notify = () => listeners.forEach((fn) => fn())

export async function create<K extends SyncedTable>(
  name: K,
  data: NewRow<TableRowMap[K]>,
  opts: { seed?: boolean } = {},
): Promise<TableRowMap[K]> {
  const ts = nowIso()
  const row = {
    ...data,
    id: data.id ?? newId(),
    user_id: currentUserId,
    created_at: data.created_at ?? ts,
    updated_at: ts,
    deleted_at: null,
  } as unknown as TableRowMap[K]
  await db.transaction('rw', [table(name), db.sync_operations], async () => {
    await table(name).put(row)
    await enqueue(name, row, opts.seed)
  })
  notify()
  return row
}

export async function update<K extends SyncedTable>(
  name: K,
  id: string,
  patch: Partial<Omit<TableRowMap[K], keyof Row>>,
): Promise<TableRowMap[K]> {
  let next: TableRowMap[K] | undefined
  await db.transaction('rw', [table(name), db.sync_operations], async () => {
    const existing = await table(name).get(id)
    if (!existing || existing.user_id !== currentUserId) throw new Error(`${name}/${id} not found`)
    next = { ...existing, ...patch, updated_at: nowIso() }
    await table(name).put(next)
    await enqueue(name, next)
  })
  notify()
  return next!
}

/** Soft delete: keeps a tombstone so the deletion syncs and wins over stale copies. */
export async function remove(name: SyncedTable, id: string) {
  await db.transaction('rw', [table(name), db.sync_operations], async () => {
    const existing = await table(name).get(id)
    if (!existing || existing.user_id !== currentUserId) return
    const ts = nowIso()
    const next = { ...existing, deleted_at: ts, updated_at: ts }
    await table(name).put(next)
    await enqueue(name, next)
  })
  notify()
}

const alive = <T extends Row>(r: T) => r.deleted_at === null && r.user_id === currentUserId

export async function list<K extends SyncedTable>(name: K): Promise<TableRowMap[K][]> {
  const rows = await table(name).where('user_id').equals(currentUserId).toArray()
  return rows.filter(alive)
}

export async function get<K extends SyncedTable>(name: K, id: string): Promise<TableRowMap[K] | undefined> {
  const row = await table(name).get(id)
  return row && alive(row) ? row : undefined
}

export async function where<K extends SyncedTable>(
  name: K,
  index: string,
  value: string | number,
): Promise<TableRowMap[K][]> {
  const rows = await table(name).where(index).equals(value).toArray()
  return rows.filter(alive)
}

export async function forDate<K extends SyncedTable>(name: K, date: string): Promise<TableRowMap[K][]> {
  const rows = await table(name).where('date').equals(date).toArray()
  return rows.filter(alive)
}

export async function forDateRange<K extends SyncedTable>(
  name: K,
  start: string,
  end: string,
): Promise<TableRowMap[K][]> {
  const rows = await table(name).where('date').between(start, end, true, true).toArray()
  return rows.filter(alive)
}
