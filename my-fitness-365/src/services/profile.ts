import { db } from '@/data/db'
import { getUserId, update } from '@/data/repo'
import type { Profile, UserSettings } from '@/data/types'

export async function getProfile(): Promise<Profile | undefined> {
  const rows = await db.profiles.where('user_id').equals(getUserId()).toArray()
  return rows.find((r) => !r.deleted_at)
}

export async function getSettings(): Promise<UserSettings | undefined> {
  const rows = await db.user_settings.where('user_id').equals(getUserId()).toArray()
  return rows.find((r) => !r.deleted_at)
}

export async function updateProfile(patch: Partial<Profile>) {
  const p = await getProfile()
  if (!p) throw new Error('Profile not found')
  return update('profiles', p.id, patch)
}

export async function updateSettings(patch: Partial<UserSettings>) {
  const s = await getSettings()
  if (!s) throw new Error('Settings not found')
  return update('user_settings', s.id, patch)
}
