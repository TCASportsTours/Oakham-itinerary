import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, Download, HardDrive, LogOut, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Badge, Button, Card, Collapsible, Field, Input, PageHeader, SectionTitle, Segmented } from '@/components/ui'
import { ScheduleEditor } from '@/components/ScheduleEditor'
import { useProfile, useSession, useSettings } from '@/app/session'
import { updateProfile, updateSettings } from '@/services/profile'
import { csvExports, downloadFile, exportAll, exportWithPhotos, importAll, wipeLocalData } from '@/services/backup'
import { pendingCount } from '@/data/sync'
import { supabase, PHOTO_BUCKET } from '@/data/supabase'
import { macroTargets, DAY_TYPE_LABEL, type DayType } from '@/lib/nutrition'
import { today } from '@/lib/dates'
import { clearPhotoCache } from '@/services/photos'

export function SettingsPage() {
  const profile = useProfile()
  const settings = useSettings()
  const session = useSession()
  const pending = useLiveQuery(() => pendingCount(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!profile || !settings) return null

  const num = (fn: (v: number) => unknown) => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    if (Number.isFinite(v) && e.target.value !== '') fn(v)
  }
  const stamp = today()

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" back="/" />

      <Card className="space-y-3">
        <SectionTitle>Account & storage</SectionTitle>
        {session.mode === 'cloud' ? (
          <>
            <p className="flex items-center gap-2"><Cloud className="h-5 w-5 text-accent" aria-hidden /> Signed in as {session.email}</p>
            <p className="text-sm text-muted">Changes waiting to sync: <span className="tnum font-semibold text-ink">{pending ?? 0}</span>{session.lastSync?.failed ? ` · ${session.lastSync.failed} failed last time` : ''}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => session.sync()}><RefreshCw className="h-4 w-4" aria-hidden /> Sync now</Button>
              <Button onClick={() => session.signOut()}><LogOut className="h-4 w-4" aria-hidden /> Sign out</Button>
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-warn" aria-hidden /> Local-only mode <Badge tone="warn">No cloud backup</Badge></p>
            <p className="text-sm text-muted">Everything, including progress photos, is stored only in this browser on this device. If Safari’s website data is cleared or the app is removed from the Home Screen, it is gone. Export a backup regularly, or connect Supabase (see README) for private cloud storage.</p>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Profile</SectionTitle>
        <Field label="Name" htmlFor="s-name"><Input id="s-name" defaultValue={profile.display_name} onBlur={(e) => updateProfile({ display_name: e.target.value.trim() })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" htmlFor="s-age"><Input id="s-age" type="number" defaultValue={profile.age} onBlur={num((v) => updateProfile({ age: v }))} /></Field>
          <Field label="Height (cm)" htmlFor="s-height"><Input id="s-height" type="number" defaultValue={profile.height_cm} onBlur={num((v) => updateProfile({ height_cm: v }))} /></Field>
          <Field label="Starting baseline (kg)" htmlFor="s-start"><Input id="s-start" type="number" step="0.1" defaultValue={profile.start_weight_kg} onBlur={num((v) => updateProfile({ start_weight_kg: v }))} /></Field>
          <Field label="First milestone (kg)" htmlFor="s-target"><Input id="s-target" type="number" step="0.1" defaultValue={profile.target_weight_kg} onBlur={num((v) => updateProfile({ target_weight_kg: v }))} /></Field>
          <Field label="Long-term from (kg)" htmlFor="s-ltmin"><Input id="s-ltmin" type="number" step="0.5" defaultValue={profile.long_term_min_kg} onBlur={num((v) => updateProfile({ long_term_min_kg: v }))} /></Field>
          <Field label="Long-term to (kg)" htmlFor="s-ltmax"><Input id="s-ltmax" type="number" step="0.5" defaultValue={profile.long_term_max_kg} onBlur={num((v) => updateProfile({ long_term_max_kg: v }))} /></Field>
          <Field label="Programme start" htmlFor="s-pstart"><Input id="s-pstart" type="date" defaultValue={profile.program_start_date} onBlur={(e) => e.target.value && updateProfile({ program_start_date: e.target.value })} /></Field>
          <Field label="Heaviest dumbbell (kg)" htmlFor="s-db"><Input id="s-db" type="number" defaultValue={profile.max_dumbbell_kg} onBlur={num((v) => updateProfile({ max_dumbbell_kg: v }))} /></Field>
        </div>
        <Field label="Equipment" htmlFor="s-eq"><Input id="s-eq" defaultValue={profile.equipment} onBlur={(e) => updateProfile({ equipment: e.target.value })} /></Field>
        <Field label="Weight display" htmlFor="s-wu"><Segmented label="Weight display" value={profile.weight_unit} onChange={(v) => updateProfile({ weight_unit: v })} options={[{ value: 'st', label: 'Stones & pounds' }, { value: 'kg', label: 'Kilograms' }]} /></Field>
        <Field label="Body measurements" htmlFor="s-lu"><Segmented label="Length unit" value={profile.length_unit} onChange={(v) => updateProfile({ length_unit: v })} options={[{ value: 'cm', label: 'Centimetres' }, { value: 'in', label: 'Inches' }]} /></Field>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Daily targets</SectionTitle>
        <p className="text-sm text-muted">Provisional starting values — not validated personal requirements or medical advice. Adjust them using your weight trend, hunger, riding performance and recovery.</p>
        <Field label="Protein target (g/day)" htmlFor="s-protein"><Input id="s-protein" type="number" defaultValue={settings.protein_target_g} onBlur={num((v) => updateSettings({ protein_target_g: v }))} /></Field>
        <Field label="Share of calories from fat (%)" htmlFor="s-fat"><Input id="s-fat" type="number" defaultValue={Math.round(settings.fat_share * 100)} onBlur={num((v) => updateSettings({ fat_share: Math.min(0.5, Math.max(0.15, v / 100)) }))} /></Field>
        {(Object.keys(DAY_TYPE_LABEL) as DayType[]).map((t) => {
          const m = macroTargets(settings.calorie_targets[t], settings.protein_target_g, settings.fat_share)
          return (
            <Field key={t} label={`${DAY_TYPE_LABEL[t]} (kcal food)`} htmlFor={`s-kcal-${t}`} hint={`P ${m.protein}g × 4 + C ${m.carbs}g × 4 + F ${m.fat}g × 9 = ${m.reconciledKcal} kcal${t === 'social_cycling' ? ' — alcohol counted separately' : ''}`}>
              <Input id={`s-kcal-${t}`} type="number" step="50" defaultValue={settings.calorie_targets[t]} onBlur={num((v) => updateSettings({ calorie_targets: { ...settings.calorie_targets, [t]: v } }))} />
            </Field>
          )
        })}
      </Card>

      <Card>
        <SectionTitle>Default week</SectionTitle>
        <p className="mb-3 text-sm text-muted">Changes apply to days you haven’t edited. Past and customised days keep their history.</p>
        <ScheduleEditor value={settings.weekly_schedule} onChange={(v) => updateSettings({ weekly_schedule: v })} />
      </Card>

      <Card className="space-y-2">
        <SectionTitle>Reminders</SectionTitle>
        <label className="flex min-h-11 items-center justify-between gap-3"><span>Progress photo reminders</span><input type="checkbox" className="h-6 w-6 accent-[#51cea7]" checked={settings.photo_reminders} onChange={(e) => updateSettings({ photo_reminders: e.target.checked })} /></label>
        <Field label="Photo interval (days)" htmlFor="s-pi"><Input id="s-pi" type="number" defaultValue={settings.photo_interval_days} onBlur={num((v) => updateSettings({ photo_interval_days: v }))} /></Field>
        <label className="flex min-h-11 items-center justify-between gap-3"><span>Measurement reminders</span><input type="checkbox" className="h-6 w-6 accent-[#51cea7]" checked={settings.measurement_reminders} onChange={(e) => updateSettings({ measurement_reminders: e.target.checked })} /></label>
        <p className="text-xs text-faint">Reminders show on the Today screen. Push notifications to a locked phone are not implemented (they need a push server).</p>
      </Card>

      <Card className="space-y-2">
        <SectionTitle>Export & backup</SectionTitle>
        <Button className="w-full" onClick={async () => downloadFile(`my-fitness-365-data-${stamp}.json`, JSON.stringify(await exportAll(), null, 2), 'application/json')}><Download className="h-4 w-4" aria-hidden /> All data (JSON)</Button>
        <Button className="w-full" onClick={async () => { const csv = await csvExports(); for (const [n, c] of Object.entries(csv)) downloadFile(`${stamp}-${n}`, c, 'text/csv') }}><Download className="h-4 w-4" aria-hidden /> Weight, measurements, workouts & nutrition (CSV)</Button>
        <Button className="w-full" disabled={busy} onClick={async () => { setBusy(true); try { downloadFile(`my-fitness-365-backup-with-photos-${stamp}.json`, JSON.stringify(await exportWithPhotos()), 'application/json') } finally { setBusy(false) } }}><Download className="h-4 w-4" aria-hidden /> {busy ? 'Preparing…' : 'Full backup including photos'}</Button>
        <p className="text-xs text-faint">The photo backup contains your private photos. Store it somewhere private (e.g. your own iCloud Drive), not a shared folder.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Choose backup file" onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const r = await importAll(JSON.parse(await f.text()))
            setMsg(`Imported ${r.added} record(s); skipped ${r.skipped} already present.`)
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Import failed')
          }
        }} />
        <Button className="w-full" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" aria-hidden /> Restore from backup</Button>
        {msg && <p role="status" className="text-sm text-accent">{msg}</p>}
      </Card>

      <Card>
        <Collapsible title="Delete data">
          <div className="space-y-3">
            <p>Deletion is permanent. Export a backup first if you might want your records later.</p>
            {session.mode === 'local' ? (
              <Button variant="danger" className="w-full" onClick={async () => {
                if (!window.confirm('Delete ALL data on this device, including photos? This cannot be undone.')) return
                if (window.prompt('Type DELETE to confirm') !== 'DELETE') return
                clearPhotoCache()
                await wipeLocalData()
                window.location.href = '/'
              }}><Trash2 className="h-4 w-4" aria-hidden /> Delete all data on this device</Button>
            ) : (
              <Button variant="danger" className="w-full" onClick={async () => {
                if (!supabase || !session.userId) return
                if (!window.confirm('Delete your account and ALL data, including every progress photo, from the cloud and this device? This cannot be undone.')) return
                if (window.prompt('Type DELETE to confirm') !== 'DELETE') return
                // Photos first (storage objects), then the account (cascades every table).
                const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(session.userId, { limit: 1000 })
                if (files?.length) await supabase.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${session.userId}/${f.name}`))
                const { error } = await supabase.rpc('delete_my_account')
                if (error) return setMsg(`Account deletion failed: ${error.message}`)
                clearPhotoCache()
                await wipeLocalData()
                await supabase.auth.signOut()
                window.location.href = '/'
              }}><Trash2 className="h-4 w-4" aria-hidden /> Delete account and all data</Button>
            )}
          </div>
        </Collapsible>
      </Card>
      <p className="pb-4 text-center text-xs text-faint">My Fitness 365 · v1.0.0</p>
    </div>
  )
}
