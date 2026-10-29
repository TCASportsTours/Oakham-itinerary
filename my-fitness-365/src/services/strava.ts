import { db } from '@/data/db'
import { getUserId, list, update } from '@/data/repo'
import { nowIso } from '@/lib/dates'
import type { CyclingSession, RideIntensity } from '@/data/types'
import { getDayPlan } from './diary'
import { recordRide, type RideInput } from './rides'

/** Public client id (safe in the browser). The secret lives only in Netlify functions. */
export const STRAVA_CLIENT_ID = (import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined)?.trim() ?? ''
export const stravaAvailable = Boolean(STRAVA_CLIENT_ID) && !import.meta.env.VITE_EMBED
export const STRAVA_SCOPE = 'activity:read_all'
const FN = '/.netlify/functions'
const STATE_KEY = 'mf365-strava-state'
const FIRST_IMPORT_DAYS = 14
const AUTO_IMPORT_MINUTES = 15

/** Strava sport types imported as rides. */
export const RIDE_TYPES = new Set(['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'EMountainBikeRide', 'VirtualRide', 'Velomobile'])

export interface StravaAuth {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id: number; firstname?: string; lastname?: string }
  /** Unix seconds: only activities that started after this are requested next time. */
  imported_until?: number
  last_checked?: string
}

let http: typeof fetch = (input, init) => fetch(input, init)
/** Tests swap the network layer. */
export const setHttp = (fn: typeof fetch) => (http = fn)

const metaKey = () => `strava:${getUserId()}`
/** Tokens stay on this device (local meta table); they are never synced or exported. */
export const getStravaAuth = async () => (await db.meta.get(metaKey()))?.value as StravaAuth | undefined
const saveAuth = (a: StravaAuth) => db.meta.put({ key: metaKey(), value: a })

export function authorizeUrl(state: string, origin = window.location.origin) {
  const p = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: `${origin}/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
    state,
  })
  return `https://www.strava.com/oauth/authorize?${p}`
}

export function startConnect() {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  window.location.assign(authorizeUrl(state))
}

async function tokenRequest(body: Record<string, string>) {
  const res = await http(`${FN}/strava-token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Strava sign-in failed (${res.status})`)
  return data as StravaAuth
}

/** Handle Strava's redirect back to /strava/callback. */
export async function completeConnect(params: URLSearchParams) {
  if (params.get('error')) throw new Error('Strava access was not granted.')
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  if (!expected || params.get('state') !== expected) throw new Error('This Strava link has expired. Please try connecting again.')
  if (!(params.get('scope') ?? '').includes('activity:read')) throw new Error('Please allow access to your activities so rides can be imported.')
  const code = params.get('code')
  if (!code) throw new Error('Strava did not return an authorisation code.')
  const auth = await tokenRequest({ grant_type: 'authorization_code', code })
  await saveAuth({ ...auth, imported_until: Math.floor(Date.now() / 1000) - FIRST_IMPORT_DAYS * 86400 })
  return auth
}

async function accessToken(): Promise<string> {
  const auth = await getStravaAuth()
  if (!auth) throw new Error('Strava is not connected.')
  if (auth.expires_at - 60 > Date.now() / 1000) return auth.access_token
  const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refresh_token })
  await saveAuth({ ...auth, ...fresh, athlete: fresh.athlete ?? auth.athlete })
  return fresh.access_token
}

async function api<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const token = await accessToken()
  const q = new URLSearchParams({ path, ...query })
  const res = await http(`${FN}/strava-api?${q}`, { headers: { authorization: `Bearer ${token}` } })
  if (res.status === 429) throw new Error('Strava’s rate limit was reached. Rides will import next time.')
  if (res.status === 401) throw new Error('Strava access has expired or was revoked. Please reconnect.')
  if (!res.ok) throw new Error(`Strava request failed (${res.status})`)
  return res.json() as Promise<T>
}

export interface StravaActivity {
  id: number
  name: string
  sport_type?: string
  type?: string
  start_date: string
  /** Local wall-clock time, formatted with a misleading "Z". */
  start_date_local: string
  moving_time: number
  distance: number
  total_elevation_gain: number
  average_heartrate?: number
  kilojoules?: number
  calories?: number
}

export function guessIntensity(movingMin: number, elevationM: number): RideIntensity {
  if (movingMin >= 120 || elevationM >= 800) return 'long'
  if (movingMin <= 50) return 'easy'
  return 'moderate'
}

/**
 * Map a Strava ride to a ride record. Calories: Strava's own `calories` figure when it
 * provides one, otherwise its `kilojoules` (mechanical work; for cycling roughly equal to
 * kcal burned, the convention Strava itself uses). Null if neither exists.
 */
export function mapActivity(a: StravaActivity): RideInput | null {
  if (!RIDE_TYPES.has(a.sport_type ?? a.type ?? '')) return null
  const minutes = Math.round(a.moving_time / 60)
  const kcal = a.calories && a.calories > 0 ? Math.round(a.calories) : a.kilojoules ? Math.round(a.kilojoules) : null
  return {
    date: a.start_date_local.slice(0, 10),
    start_time: a.start_date_local.slice(11, 16) || null,
    duration_min: minutes,
    distance_km: Math.round((a.distance / 1000) * 10) / 10,
    elevation_m: Math.round(a.total_elevation_gain),
    est_kcal: kcal,
    intensity: guessIntensity(minutes, a.total_elevation_gain),
    rpe: null,
    notes: a.name,
    completed: true,
    source: 'strava',
    external_id: String(a.id),
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
  }
}

export interface ImportResult {
  added: number
  merged: number
  skipped: number
}

/** A manual ride on the same day within 20 minutes' duration is treated as the same ride. */
const sameRide = (r: CyclingSession, m: RideInput) => r.date === m.date && !r.external_id && Math.abs(r.duration_min - m.duration_min) <= 20

export async function importFromStrava(): Promise<ImportResult> {
  const auth = await getStravaAuth()
  if (!auth) throw new Error('Strava is not connected.')
  const after = auth.imported_until ?? Math.floor(Date.now() / 1000) - FIRST_IMPORT_DAYS * 86400
  const result: ImportResult = { added: 0, merged: 0, skipped: 0 }
  let newest = after
  for (let page = 1; page <= 10; page++) {
    const batch = await api<StravaActivity[]>('/athlete/activities', { after: String(after), per_page: '50', page: String(page) })
    const existing = await list('cycling_sessions')
    for (const summary of batch) {
      newest = Math.max(newest, Math.floor(Date.parse(summary.start_date) / 1000))
      if (!RIDE_TYPES.has(summary.sport_type ?? summary.type ?? '') || existing.some((r) => r.external_id === String(summary.id))) {
        result.skipped++
        continue
      }
      // Calories are only on the detailed activity.
      const detail = await api<StravaActivity>(`/activities/${summary.id}`)
      const mapped = mapActivity({ ...summary, ...detail })!
      const manual = existing.find((r) => sameRide(r, mapped))
      if (manual) {
        await update('cycling_sessions', manual.id, { source: 'strava', external_id: mapped.external_id, est_kcal: mapped.est_kcal, avg_hr: mapped.avg_hr, distance_km: manual.distance_km ?? mapped.distance_km, elevation_m: manual.elevation_m ?? mapped.elevation_m })
        result.merged++
        continue
      }
      const planned = (await getDayPlan(mapped.date)).find((p) => p.kind === 'ride' && p.status === 'planned')
      await recordRide(mapped, planned)
      result.added++
    }
    if (batch.length < 50) break
  }
  await saveAuth({ ...(await getStravaAuth())!, imported_until: newest, last_checked: nowIso() })
  return result
}

/** Import if connected and not checked in the last few minutes (on open / when the app comes back). */
export async function autoImport() {
  if (!stravaAvailable || !navigator.onLine) return null
  const auth = await getStravaAuth()
  if (!auth) return null
  if (auth.last_checked && Date.now() - Date.parse(auth.last_checked) < AUTO_IMPORT_MINUTES * 60_000) return null
  return importFromStrava()
}

export async function disconnectStrava() {
  try {
    const token = await accessToken()
    await http(`${FN}/strava-api?path=${encodeURIComponent('/oauth/deauthorize')}`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
  } catch {
    /* still remove local tokens */
  }
  await db.meta.delete(metaKey())
}

