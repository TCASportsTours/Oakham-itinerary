import { useState } from 'react'
import { useConfirm } from '@/components/confirm'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bike, ChevronRight, Info, Play, Replace } from 'lucide-react'
import { Badge, Button, Card, Collapsible, Field, Input, PageHeader, SectionTitle, Segmented, Select, Sheet } from '@/components/ui'
import { list, update, where } from '@/data/repo'
import { completedSessions, getActiveSession, getTemplateDetail, previousPerformance, startSession } from '@/services/workouts'
import { rides, weekTotals, deleteRide } from '@/services/rides'
import { PROGRESSION, RECOVERY_GUIDANCE, SAFETY_NOTES, WARMUP } from '@/data/seed/workouts'
import { WEEKDAY_NAMES, formatUK, today, weekStart, shiftDate, daysBetween } from '@/lib/dates'
import { ExerciseThumb } from './ExerciseMedia'
import { RideSheet } from '@/features/rides/RideSheet'
import { useProfile } from '@/app/session'
import type { CyclingSession, WorkoutTemplateExercise } from '@/data/types'

type Tab = 'programme' | 'library' | 'history' | 'rides'

export function Workouts() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'programme'
  return (
    <div>
      <PageHeader title="Workouts" />
      <div className="mb-4">
        <Segmented label="Section" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} options={[{ value: 'programme', label: 'Plan' }, { value: 'library', label: 'Library' }, { value: 'history', label: 'History' }, { value: 'rides', label: 'Rides' }]} />
      </div>
      {tab === 'programme' && <Programme />}
      {tab === 'library' && <Library />}
      {tab === 'history' && <History />}
      {tab === 'rides' && <Rides />}
    </div>
  )
}

function Programme() {
  const profile = useProfile()
  const templates = useLiveQuery(async () => (await list('workout_templates')).sort((a, b) => a.key.localeCompare(b.key)), [])
  const active = useLiveQuery(() => getActiveSession(), [])
  const week = profile ? Math.floor(Math.max(0, daysBetween(profile.program_start_date, today())) / 7) + 1 : 1
  const phase = PROGRESSION.find((p) => {
    const [a, b] = p.weeks.replace('Weeks ', '').split('–').map(Number)
    return week >= a && week <= b
  }) ?? PROGRESSION.at(-1)!
  return (
    <div className="space-y-4">
      {active && (
        <Card className="border border-accent/40">
          <p className="text-sm text-muted">In progress</p>
          <p className="font-semibold">{active.name}</p>
          <Link to={`/workouts/session/${active.id}`} className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent">Resume →</Link>
        </Card>
      )}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Programme week {week}</p>
        <p className="font-semibold">{phase.weeks}: {phase.text}</p>
        <p className="mt-1 text-sm text-muted">Finish each set with 2–3 reps in reserve. Rest 60–120 seconds between sets.</p>
      </Card>
      {templates?.map((t) => (
        <Link key={t.id} to={`/workouts/template/${t.id}`} className="block rounded-[var(--radius-card)] bg-surface p-4 hover:bg-surface-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-lg font-bold italic">{t.name}</p>
              <p className="text-sm text-muted">Default {WEEKDAY_NAMES[t.default_weekday]} · {t.duration_text} · 5 exercises</p>
            </div>
            <ChevronRight className="h-5 w-5 text-faint" aria-hidden />
          </div>
        </Link>
      ))}
      <Collapsible title="Warm-up (every session)">
        <ol className="list-decimal space-y-1 pl-5">{WARMUP.map((w) => <li key={w}>{w}</li>)}</ol>
      </Collapsible>
      <Collapsible title="Progression plan">
        <ul className="space-y-1">{PROGRESSION.map((p) => <li key={p.weeks}><span className="font-semibold text-ink">{p.weeks}:</span> {p.text}</li>)}</ul>
      </Collapsible>
      <Collapsible title="Safety">
        <ul className="list-disc space-y-1 pl-5">{SAFETY_NOTES.map((w) => <li key={w}>{w}</li>)}</ul>
      </Collapsible>
      <Collapsible title="Recovery">
        <ul className="list-disc space-y-1 pl-5">{RECOVERY_GUIDANCE.map((w) => <li key={w}>{w}</li>)}</ul>
      </Collapsible>
    </div>
  )
}

export function TemplateDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const detail = useLiveQuery(() => getTemplateDetail(id), [id])
  const allExercises = useLiveQuery(() => list('exercises'), []) ?? []
  const lastWeights = useLiveQuery(async () => {
    if (!detail) return {}
    const out: Record<string, string> = {}
    for (const { exercise } of detail.items) {
      const prev = await previousPerformance(exercise.id)
      if (prev) out[exercise.id] = `${prev.sets[0].weight_kg ?? 0}kg × ${prev.sets[0].reps ?? `${prev.sets[0].seconds}s`}`
    }
    return out
  }, [detail])
  const [editing, setEditing] = useState<WorkoutTemplateExercise | null>(null)
  if (!detail) return null
  return (
    <div className="space-y-4">
      <PageHeader title={detail.template.name} subtitle={`${detail.template.duration_text} · Default ${WEEKDAY_NAMES[detail.template.default_weekday]}`} back="/workouts" />
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={async () => {
          const s = await startSession(detail.template.id, today())
          nav(`/workouts/session/${s.id}`)
        }}
      >
        <Play className="h-5 w-5" aria-hidden /> Start workout today
      </Button>
      <ul className="space-y-2">
        {detail.items.map(({ te, exercise }, i) => (
          <li key={te.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <ExerciseThumb exercise={exercise} />
            <Link to={`/workouts/exercise/${exercise.id}`} className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{i + 1}. {exercise.name}</p>
              <p className="tnum text-sm text-muted">
                {te.sets} × {te.reps_min === te.reps_max ? te.reps_min : `${te.reps_min}–${te.reps_max}`}{te.rep_unit === 'seconds' ? 's' : ''}{te.per_side ? ' each side' : ''} · {te.suggested_weight}
              </p>
              {lastWeights?.[exercise.id] && <p className="text-xs text-accent">Last: {lastWeights[exercise.id]}</p>}
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setEditing(te)} aria-label={`Edit ${exercise.name}`}>Edit</Button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-faint">Suggested weights are starting suggestions only — start lighter, swap a movement or reduce sets whenever you need to.</p>
      {editing && <EditTemplateExercise te={editing} allExercises={allExercises} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditTemplateExercise({ te, allExercises, onClose }: { te: WorkoutTemplateExercise; allExercises: { id: string; name: string; alternatives: string[]; key: string }[]; onClose: () => void }) {
  const [form, setForm] = useState({ ...te })
  const current = allExercises.find((e) => e.id === te.exercise_id)
  const alternatives = allExercises.filter((e) => e.id !== te.exercise_id)
  const num = (k: 'sets' | 'reps_min' | 'reps_max' | 'rest_seconds') => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) })
  return (
    <Sheet open onClose={onClose} title={`Edit ${current?.name ?? 'exercise'}`}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          await update('workout_template_exercises', te.id, { exercise_id: form.exercise_id, sets: form.sets, reps_min: form.reps_min, reps_max: Math.max(form.reps_min, form.reps_max), rest_seconds: form.rest_seconds, suggested_weight: form.suggested_weight })
          onClose()
        }}
      >
        <Field label="Exercise (substitute)" htmlFor="sub" hint={current?.alternatives.length ? `Suggested alternatives: ${current.alternatives.map((k) => allExercises.find((e) => e.key === k)?.name).filter(Boolean).join(', ')}` : undefined}>
          <Select id="sub" value={form.exercise_id} onChange={(e) => setForm({ ...form, exercise_id: e.target.value })}>
            {current && <option value={current.id}>{current.name} (current)</option>}
            {alternatives.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sets" htmlFor="sets"><Input id="sets" type="number" min={1} max={6} value={form.sets} onChange={num('sets')} /></Field>
          <Field label={form.rep_unit === 'seconds' ? 'Min sec' : 'Min reps'} htmlFor="rmin"><Input id="rmin" type="number" min={1} value={form.reps_min} onChange={num('reps_min')} /></Field>
          <Field label={form.rep_unit === 'seconds' ? 'Max sec' : 'Max reps'} htmlFor="rmax"><Input id="rmax" type="number" min={1} value={form.reps_max} onChange={num('reps_max')} /></Field>
        </div>
        <Field label="Rest between sets (seconds)" htmlFor="rest"><Input id="rest" type="number" min={30} step={15} value={form.rest_seconds} onChange={num('rest_seconds')} /></Field>
        <Field label="Suggested weight" htmlFor="sw"><Input id="sw" value={form.suggested_weight} onChange={(e) => setForm({ ...form, suggested_weight: e.target.value })} /></Field>
        <Button type="submit" variant="primary" className="w-full"><Replace className="h-4 w-4" aria-hidden /> Save changes</Button>
      </form>
    </Sheet>
  )
}

function Library() {
  const exercises = useLiveQuery(async () => (await list('exercises')).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [])
  return (
    <ul className="space-y-2">
      {exercises?.map((e) => (
        <li key={e.id}>
          <Link to={`/workouts/exercise/${e.id}`} className="flex items-center gap-3 rounded-2xl bg-surface p-3 hover:bg-surface-2">
            <ExerciseThumb exercise={e} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{e.name}</p>
              <p className="text-sm text-muted">{e.primary_muscles.join(', ')}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge>{e.category}</Badge>
              {e.tags.includes('substitute') && <Badge tone="data">Substitute</Badge>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function History() {
  const sessions = useLiveQuery(() => completedSessions(), [])
  if (!sessions) return null
  if (!sessions.length) return <p className="text-muted">No completed workouts yet. Finished sessions appear here.</p>
  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link to={`/workouts/history/${s.id}`} className="flex items-center justify-between gap-2 rounded-2xl bg-surface p-3 hover:bg-surface-2">
            <span>
              <span className="block font-semibold">{s.name}</span>
              <span className="block text-sm text-muted">{formatUK(s.date)}{s.finished_at && ` · ${Math.round((Date.parse(s.finished_at) - Date.parse(s.started_at)) / 60000)} min`}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-faint" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function SessionDetail() {
  const { id = '' } = useParams()
  const data = useLiveQuery(async () => {
    const s = (await list('workout_sessions')).find((x) => x.id === id)
    const sets = await where('workout_sets', 'session_id', id)
    const exercises = await list('exercises')
    return { s, sets, exercises }
  }, [id])
  if (!data?.s) return null
  const byEx = new Map<string, typeof data.sets>()
  for (const set of data.sets.sort((a, b) => a.set_number - b.set_number)) byEx.set(set.exercise_id, [...(byEx.get(set.exercise_id) ?? []), set])
  return (
    <div className="space-y-4">
      <PageHeader title={data.s.name} subtitle={formatUK(data.s.date)} back="/workouts?tab=history" />
      {[...byEx.entries()].map(([exId, sets]) => (
        <Card key={exId}>
          <p className="font-semibold">{data.exercises.find((e) => e.id === exId)?.name}</p>
          <ul className="tnum mt-1 text-sm text-muted">
            {sets.map((s) => (
              <li key={s.id}>
                Set {s.set_number}: {s.weight_kg ?? 0}kg × {s.reps ?? `${s.seconds}s`} {s.completed ? '✓' : '(not completed)'}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {data.s.notes && <Card><p className="text-sm text-muted">{data.s.notes}</p></Card>}
    </div>
  )
}

function Rides() {
  const confirm = useConfirm()
  const all = useLiveQuery(() => rides(), [])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CyclingSession | null>(null)
  if (!all) return null
  const ws = weekStart(today())
  const wk = weekTotals(all, ws, shiftDate(ws, 6))
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>This week</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <div><p className="text-xs uppercase text-faint">Rides</p><p className="tnum text-xl font-bold">{wk.count}</p></div>
          <div><p className="text-xs uppercase text-faint">Time</p><p className="tnum text-xl font-bold">{Math.floor(wk.minutes / 60)}h {wk.minutes % 60}m</p></div>
          <div><p className="text-xs uppercase text-faint">Distance</p><p className="tnum text-xl font-bold">{wk.km.toFixed(1)} km</p></div>
        </div>
        <p className="mt-2 text-sm text-muted">Estimated energy: ~{wk.kcal.toLocaleString('en-GB')} kcal (estimate, unverified).</p>
      </Card>
      <Button variant="primary" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <Bike className="h-5 w-5" aria-hidden /> Record a ride
      </Button>
      <Collapsible title="Ride nutrition guidance" icon={<Info className="h-5 w-5 text-accent" aria-hidden />}>
        <p className="font-semibold text-ink">Before (2–3h)</p>
        <p>Porridge and banana, a chicken rice bowl or toast with eggs.</p>
        <p className="mt-2 font-semibold text-ink">During (rides over ~90 min)</p>
        <p>Roughly 30–60g carbohydrate per hour after the first hour — e.g. a banana (~20g), rice cakes, or a sports drink. Log anything you eat under “On the bike”.</p>
        <p className="mt-2 font-semibold text-ink">After</p>
        <p>A meal with protein and carbohydrate within a couple of hours — e.g. Cajun chicken and rice, or a protein shake if dinner is later.</p>
        <p className="mt-2 font-semibold text-ink">Hydration</p>
        <p>Start hydrated, sip regularly (more in heat), and add electrolytes on long or hot rides.</p>
      </Collapsible>
      <ul className="space-y-2">
        {all.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <Bike className="h-5 w-5 text-data" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{formatUK(r.date)} · {r.intensity[0].toUpperCase() + r.intensity.slice(1)}</p>
              <p className="tnum text-sm text-muted">{r.duration_min} min{r.distance_km ? ` · ${r.distance_km} km` : ''}{r.elevation_m ? ` · ${r.elevation_m} m up` : ''}{r.rpe ? ` · RPE ${r.rpe}` : ''}{r.est_kcal ? ` · ~${r.est_kcal} kcal est.` : ''}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={async () => (await confirm({ title: 'Delete ride?', message: `The ride on ${formatUK(r.date)} will be removed.`, confirmLabel: 'Delete', destructive: true })) && deleteRide(r.id)}>Delete</Button>
          </li>
        ))}
      </ul>
      {open && <RideSheet open onClose={() => setOpen(false)} date={today()} />}
      {editing && <RideSheet open onClose={() => setEditing(null)} date={editing.date} ride={editing} />}
    </div>
  )
}
