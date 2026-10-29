import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bike, Link2, RefreshCw, Unlink } from 'lucide-react'
import { Badge, Button, Card, Field, Input, LinkButton, SectionTitle, Segmented } from '@/components/ui'
import { useConfirm } from '@/components/confirm'
import { useSession, useSettings } from '@/app/session'
import { updateSettings } from '@/services/profile'
import { autoImport, completeConnect, disconnectStrava, getStravaAuth, importFromStrava, startConnect, stravaAvailable } from '@/services/strava'

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Strava redirects here after the user approves access. */
export function StravaCallback() {
  const nav = useNavigate()
  const [message, setMessage] = useState('Connecting to Strava…')
  const [failed, setFailed] = useState(false)
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const auth = await completeConnect(new URLSearchParams(window.location.search))
        setMessage(`Connected as ${auth.athlete?.firstname ?? 'you'}. Importing recent rides…`)
        const r = await importFromStrava()
        setMessage(`Imported ${plural(r.added, 'ride')}${r.merged ? `, matched ${r.merged} you had already logged` : ''}.`)
        setTimeout(() => nav('/settings', { replace: true }), 1500)
      } catch (e) {
        setFailed(true)
        setMessage(e instanceof Error ? e.message : 'Could not connect to Strava.')
      }
    })()
  }, [nav])
  return (
    <div className="pt-safe mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-3xl">Strava</h1>
      <p role="status" className={failed ? 'text-danger' : 'text-muted'}>{message}</p>
      {failed && <LinkButton to="/settings" variant="primary">Back to Settings</LinkButton>}
    </div>
  )
}

/** Runs a Strava import when the app opens and whenever it comes back to the foreground. */
export function useStravaAutoImport() {
  const { status } = useSession()
  useEffect(() => {
    if (status !== 'ready' || !stravaAvailable) return
    const run = () => autoImport().catch(() => undefined)
    const onVisible = () => document.visibilityState === 'visible' && run()
    run()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status])
}

export function StravaCard() {
  const auth = useLiveQuery(() => getStravaAuth(), [])
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <Card className="space-y-3">
      <SectionTitle>Strava</SectionTitle>
      {!stravaAvailable ? (
        <div className="space-y-2 text-sm text-muted">
          <p className="flex items-center gap-2"><Badge tone="warn">Not set up yet</Badge></p>
          <p>Strava can be linked once the app is deployed with a Strava API application. Then you tap <span className="text-ink">Connect with Strava</span> here, approve access once, and your rides (time, distance, climbing, heart rate and Strava’s calories) are imported each time you open the app.</p>
          <p>Until then, record rides with <span className="text-ink">Record ride</span> as normal.</p>
        </div>
      ) : auth ? (
        <>
          <p className="flex items-center gap-2"><Bike className="h-5 w-5 text-[#fc4c02]" aria-hidden /> Connected{auth.athlete?.firstname ? ` as ${auth.athlete.firstname}` : ''}</p>
          <p className="text-sm text-muted">Last checked: {auth.last_checked ? new Date(auth.last_checked).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : 'not yet'}. Rides import automatically when you open the app.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={async () => {
              setBusy(true); setMsg(null)
              try {
                const r = await importFromStrava()
                setMsg(r.added || r.merged ? `Imported ${plural(r.added, 'new ride')}${r.merged ? `, matched ${r.merged} logged by hand` : ''}.` : 'No new rides.')
              } catch (e) { setMsg(e instanceof Error ? e.message : 'Import failed') } finally { setBusy(false) }
            }}><RefreshCw className="h-4 w-4" aria-hidden /> {busy ? 'Checking…' : 'Import now'}</Button>
            <Button variant="danger" onClick={async () => {
              if (await confirm({ title: 'Disconnect Strava?', message: 'Rides already imported stay in your diary. New rides will stop importing.', confirmLabel: 'Disconnect', destructive: true })) await disconnectStrava()
            }}><Unlink className="h-4 w-4" aria-hidden /> Disconnect</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Import your rides from Strava with their time, distance, climbing, heart rate and Strava’s calorie figure. You approve access once on Strava’s site; you can disconnect at any time.</p>
          <Button className="w-full bg-[#fc4c02] font-bold text-white hover:brightness-110" onClick={startConnect}><Link2 className="h-4 w-4" aria-hidden /> Connect with Strava</Button>
        </>
      )}
      {msg && <p role="status" className="text-sm text-accent">{msg}</p>}
    </Card>
  )
}

export function RideCaloriesCard() {
  const settings = useSettings()
  if (!settings) return null
  const on = settings.count_ride_kcal ?? true
  const source = settings.ride_kcal_source ?? 'strava'
  const share = settings.ride_kcal_share ?? 100
  return (
    <Card className="space-y-3">
      <SectionTitle>Ride calories in your allowance</SectionTitle>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Add ride calories to my food allowance</span>
        <input type="checkbox" className="h-6 w-6 accent-[#51cea7]" checked={on} onChange={(e) => updateSettings({ count_ride_kcal: e.target.checked })} />
      </label>
      {on && (
        <>
          <Field label="Which rides count" htmlFor="ride-src">
            <Segmented label="Which rides count" value={source} onChange={(v) => updateSettings({ ride_kcal_source: v })} options={[{ value: 'strava', label: 'Strava rides' }, { value: 'all', label: 'All recorded rides' }]} />
          </Field>
          <Field label="Share of ride calories added (%)" htmlFor="ride-share" hint="100% adds them all. Some people add back only part, because activity calorie figures are estimates.">
            <Input id="ride-share" type="number" min={0} max={100} step={5} defaultValue={share} onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateSettings({ ride_kcal_share: Math.min(100, Math.max(0, v)) }) }} />
          </Field>
          <p className="text-sm text-muted">
            So riding isn’t counted twice: once a counted ride is recorded, that day’s allowance switches from the cycling-day target to the day’s non-riding target (gym or rest) plus the ride calories. Example: rest day {settings.calorie_targets.rest.toLocaleString('en-GB')} + 1,100 Strava kcal × {share}% = {(settings.calorie_targets.rest + Math.round(1100 * share / 100)).toLocaleString('en-GB')} kcal. Before a ride is recorded, the planned cycling-day target is shown.
          </p>
        </>
      )}
    </Card>
  )
}
