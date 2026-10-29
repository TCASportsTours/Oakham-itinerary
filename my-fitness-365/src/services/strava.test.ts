import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, db } from '@/data/db'
import { list, setSession } from '@/data/repo'
import { seedUser } from '@/data/seed'
import { completeConnect, getStravaAuth, guessIntensity, importFromStrava, mapActivity, setHttp, type StravaActivity } from './strava'
import { dayTargets } from './meals'
import { getDayPlan, updateDiary } from './diary'
import { recordRide } from './rides'
import { getSettings, updateSettings } from './profile'

const TUESDAY = '2026-11-03' // default plan: moderate ride → cycling day (2,600)

const activity = (over: Partial<StravaActivity> = {}): StravaActivity => ({
  id: 111,
  name: 'Lunchtime MTB',
  sport_type: 'MountainBikeRide',
  start_date: '2026-11-03T12:05:00Z',
  start_date_local: '2026-11-03T12:05:00Z',
  moving_time: 5400,
  distance: 28500,
  total_elevation_gain: 420,
  average_heartrate: 141.4,
  ...over,
})

/** Fake network: Strava list + detail endpoints behind the Netlify function paths. */
function fakeStrava(activities: StravaActivity[], details: Record<number, Partial<StravaActivity>>, log: string[] = []) {
  setHttp((async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://app.test')
    log.push(`${init?.method ?? 'GET'} ${url.pathname}${url.searchParams.get('path') ?? ''}`)
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
    if (url.pathname.endsWith('/strava-token')) return ok({ access_token: 'new', refresh_token: 'r2', expires_at: Date.now() / 1000 + 21600, athlete: { id: 1, firstname: 'Chris' } })
    const path = url.searchParams.get('path')!
    if (path === '/athlete/activities') return ok(url.searchParams.get('page') === '1' ? activities : [])
    const id = Number(path.split('/').pop())
    return ok({ ...activities.find((a) => a.id === id), ...details[id] })
  }) as typeof fetch)
}

async function connected(expiresInSec = 3600) {
  await db.meta.put({ key: 'strava:u', value: { access_token: 'a', refresh_token: 'r', expires_at: Date.now() / 1000 + expiresInSec, imported_until: 0 } })
}

beforeEach(async () => {
  openDatabase(`strava-${Math.random()}`)
  setSession('u', false)
  await seedUser('u')
})

describe('mapping Strava activities', () => {
  it('maps a mountain-bike ride with Strava calories', () => {
    const m = mapActivity({ ...activity(), calories: 1134.6 })!
    expect(m).toMatchObject({ date: '2026-11-03', start_time: '12:05', duration_min: 90, distance_km: 28.5, elevation_m: 420, est_kcal: 1135, avg_hr: 141, source: 'strava', external_id: '111', intensity: 'moderate', notes: 'Lunchtime MTB' })
  })
  it('falls back to kilojoules, then to no calories', () => {
    expect(mapActivity({ ...activity(), kilojoules: 980 })!.est_kcal).toBe(980)
    expect(mapActivity(activity())!.est_kcal).toBeNull()
  })
  it('ignores non-ride activities', () => {
    expect(mapActivity(activity({ sport_type: 'Run' }))).toBeNull()
  })
  it('guesses intensity from time and climbing', () => {
    expect(guessIntensity(45, 100)).toBe('easy')
    expect(guessIntensity(90, 400)).toBe('moderate')
    expect(guessIntensity(150, 300)).toBe('long')
    expect(guessIntensity(80, 900)).toBe('long')
  })
})

describe('connecting', () => {
  it('rejects a callback whose state does not match', async () => {
    sessionStorage.setItem('mf365-strava-state', 'expected')
    await expect(completeConnect(new URLSearchParams('state=other&code=x&scope=read,activity:read_all'))).rejects.toThrow(/expired/)
  })
  it('rejects a callback without activity access', async () => {
    sessionStorage.setItem('mf365-strava-state', 's')
    await expect(completeConnect(new URLSearchParams('state=s&code=x&scope=read'))).rejects.toThrow(/allow access/)
  })
  it('stores tokens on the device after a valid callback', async () => {
    fakeStrava([], {})
    sessionStorage.setItem('mf365-strava-state', 's')
    await completeConnect(new URLSearchParams('state=s&code=abc&scope=read,activity:read_all'))
    expect((await getStravaAuth())!.athlete!.firstname).toBe('Chris')
  })
})

describe('importing', () => {
  it('imports rides with calories, completes the planned ride, and never duplicates', async () => {
    await connected()
    const log: string[] = []
    fakeStrava([activity(), activity({ id: 222, sport_type: 'Run' })], { 111: { calories: 1100 } }, log)
    const r = await importFromStrava()
    expect(r).toEqual({ added: 1, merged: 0, skipped: 1 })
    const rides = await list('cycling_sessions')
    expect(rides).toHaveLength(1)
    expect(rides[0]).toMatchObject({ est_kcal: 1100, source: 'strava', external_id: '111' })
    expect((await getDayPlan(TUESDAY)).find((p) => p.kind === 'ride')!.status).toBe('completed')
    // Running again does not add it twice
    await db.meta.update('strava:u', { value: { ...(await getStravaAuth())!, imported_until: 0 } })
    expect((await importFromStrava()).added).toBe(0)
    expect(await list('cycling_sessions')).toHaveLength(1)
  })

  it('merges with a ride already logged by hand instead of duplicating', async () => {
    await connected()
    await recordRide({ date: TUESDAY, start_time: null, duration_min: 85, distance_km: null, elevation_m: null, est_kcal: 900, intensity: 'moderate', rpe: 6, notes: '', completed: true })
    fakeStrava([activity()], { 111: { calories: 1100 } })
    expect((await importFromStrava()).merged).toBe(1)
    const rides = await list('cycling_sessions')
    expect(rides).toHaveLength(1)
    expect(rides[0]).toMatchObject({ est_kcal: 1100, source: 'strava', rpe: 6, distance_km: 28.5 })
  })

  it('refreshes an expired token through the server function', async () => {
    await connected(-10)
    const log: string[] = []
    fakeStrava([], {}, log)
    await importFromStrava()
    expect(log[0]).toBe('POST /.netlify/functions/strava-token')
    expect((await getStravaAuth())!.access_token).toBe('new')
  })
})

describe('ride calories in the allowance', () => {
  it('uses the planned cycling target until a ride is recorded', async () => {
    expect((await dayTargets(TUESDAY)).kcal).toBe(2600)
  })

  it('adds Strava calories to the non-riding base so riding is not counted twice', async () => {
    await recordRide({ ...mapActivity({ ...activity(), calories: 1100 })! })
    const t = await dayTargets(TUESDAY)
    expect(t.base).toEqual({ type: 'rest', kcal: 2100 })
    expect(t.kcal).toBe(2100 + 1100)
    expect(t.rideCredits).toEqual([{ name: 'Lunchtime MTB', kcal: 1100, source: 'strava' }])
    expect(Math.abs(t.reconciledKcal - 3200)).toBeLessThan(5)
  })

  it('uses the gym target as the base on a workout + ride day (Monday)', async () => {
    await recordRide({ ...mapActivity({ ...activity({ start_date_local: '2026-11-02T18:00:00Z' }), calories: 400 })! })
    const t = await dayTargets('2026-11-02')
    expect(t.base.type).toBe('gym')
    expect(t.kcal).toBe(2300 + 400)
  })

  it('does not count manual estimates unless chosen, and respects the share', async () => {
    await recordRide({ date: TUESDAY, start_time: null, duration_min: 90, distance_km: null, elevation_m: null, est_kcal: 1000, intensity: 'moderate', rpe: null, notes: '', completed: true })
    expect((await dayTargets(TUESDAY)).kcal).toBe(2600)
    await updateSettings({ ride_kcal_source: 'all', ride_kcal_share: 50 })
    expect((await dayTargets(TUESDAY)).kcal).toBe(2100 + 500)
    await updateSettings({ count_ride_kcal: false })
    expect((await dayTargets(TUESDAY)).kcal).toBe(2600)
  })

  it('handles settings rows created before these options existed', async () => {
    const s = (await getSettings())!
    const { count_ride_kcal: _a, ride_kcal_source: _b, ride_kcal_share: _c, ...old } = s
    await db.user_settings.put(old as typeof s)
    await recordRide({ ...mapActivity({ ...activity(), calories: 1100 })! })
    expect((await dayTargets(TUESDAY)).kcal).toBe(3200)
  })

  it('a rest/gym day-type override sets the base', async () => {
    await updateDiary(TUESDAY, { day_type_override: 'gym' })
    await recordRide({ ...mapActivity({ ...activity(), calories: 1100 })! })
    expect((await dayTargets(TUESDAY)).kcal).toBe(2300 + 1100)
  })
})
