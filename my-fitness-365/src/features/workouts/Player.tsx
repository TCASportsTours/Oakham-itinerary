import { useEffect, useState } from 'react'
import { useConfirm } from '@/components/confirm'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight, Minus, Plus, SkipForward, Timer, X } from 'lucide-react'
import { Badge, Button, Card, Field, PageHeader, Sheet, Textarea } from '@/components/ui'
import { get } from '@/data/repo'
import { abandonSession, addSet, finishSession, getSessionSets, getTemplateDetail, previousPerformance, setCurrentIndex, skipExercise, toggleSetComplete, updateSet } from '@/services/workouts'
import { ExerciseBody } from './ExerciseDetail'
import { ExerciseThumb } from './ExerciseMedia'
import { cn } from '@/lib/cn'
import { formatUK } from '@/lib/dates'
import type { WorkoutSet } from '@/data/types'

const REST_KEY = 'mf365-rest-until'

export function Player() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const confirm = useConfirm()
  const session = useLiveQuery(() => get('workout_sessions', id), [id])
  const detail = useLiveQuery(() => (session ? getTemplateDetail(session.template_id) : undefined), [session?.template_id])
  const sets = useLiveQuery(() => getSessionSets(id), [id])
  const [finishing, setFinishing] = useState(false)
  const [notes, setNotes] = useState('')
  const [restUntil, setRestUntil] = useState<number | null>(() => {
    const v = Number(sessionStorage.getItem(REST_KEY))
    return v > Date.now() ? v : null
  })

  const index = Math.min(session?.current_index ?? 0, (detail?.items.length ?? 1) - 1)
  const current = detail?.items[index]
  const prev = useLiveQuery(() => (current ? previousPerformance(current.exercise.id, id) : undefined), [current?.exercise.id, id])

  if (session === undefined || !detail || !sets) return <p className="pt-safe text-muted">Loading workout…</p>
  if (!session) return <p className="pt-safe">Workout not found.</p>
  if (session.status !== 'in_progress') {
    return (
      <div className="pt-safe space-y-4">
        <PageHeader title={session.name} subtitle={`This session is ${session.status === 'completed' ? 'completed' : 'closed'}.`} back="/workouts" />
        <Button onClick={() => nav(`/workouts/history/${session.id}`)}>View results</Button>
      </div>
    )
  }
  const { te, exercise } = current!
  const exSets = sets.filter((s) => s.exercise_id === exercise.id)
  const skipped = session.skipped_exercise_ids.includes(exercise.id)
  const totalDone = sets.filter((s) => s.completed).length

  const startRest = () => {
    const until = Date.now() + te.rest_seconds * 1000
    sessionStorage.setItem(REST_KEY, String(until))
    setRestUntil(until)
  }
  const go = (i: number) => setCurrentIndex(session.id, Math.max(0, Math.min(detail.items.length - 1, i)))

  return (
    <div className="space-y-4 pb-24">
      <header className="pt-safe flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted">{session.name}</p>
          <h1 className="text-2xl">Exercise {index + 1} of {detail.items.length}</h1>
        </div>
        <Button variant="primary" onClick={() => setFinishing(true)}>Finish</Button>
      </header>

      <nav aria-label="Exercises" className="flex gap-1.5">
        {detail.items.map((it, i) => {
          const done = sets.filter((s) => s.exercise_id === it.exercise.id).every((s) => s.completed)
          const sk = session.skipped_exercise_ids.includes(it.exercise.id)
          return (
            <button key={it.te.id} type="button" onClick={() => go(i)} aria-label={`Go to ${it.exercise.name}${done ? ' (done)' : sk ? ' (skipped)' : ''}`} aria-current={i === index ? 'step' : undefined}
              className={cn('h-2 flex-1 rounded-full', done ? 'bg-accent' : sk ? 'bg-warn/60' : i === index ? 'bg-ink' : 'bg-surface-2')} />
          )
        })}
      </nav>

      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <ExerciseThumb exercise={exercise} className="h-20 w-20" />
          <div className="min-w-0">
            <h2 className="text-xl font-bold italic leading-tight">{exercise.name}</h2>
            <p className="tnum text-muted">
              {te.sets} × {te.reps_min === te.reps_max ? te.reps_min : `${te.reps_min}–${te.reps_max}`}{te.rep_unit === 'seconds' ? ' seconds' : ' reps'}{te.per_side ? ' each side' : ''}
            </p>
            <p className="text-sm text-faint">Suggested: {te.suggested_weight}</p>
          </div>
        </div>
        {prev && (
          <p className="tnum rounded-xl bg-surface-2/60 px-3 py-2 text-sm text-muted">
            Last time ({formatUK(prev.session.date)}): {prev.sets.map((s) => `${s.weight_kg ?? 0}kg × ${s.reps ?? `${s.seconds}s`}`).join(' · ')}
          </p>
        )}
        {skipped && <Badge tone="warn">Skipped</Badge>}

        <div className="space-y-2" role="group" aria-label="Sets">
          <div className="grid grid-cols-[2.5rem_1fr_1fr_3.25rem] gap-2 px-1 text-xs font-semibold uppercase text-faint">
            <span>Set</span><span>kg</span><span>{te.rep_unit === 'seconds' ? 'Secs' : 'Reps'}</span><span className="text-center">Done</span>
          </div>
          {exSets.map((s) => (
            <SetRow key={s.id} set={s} unit={te.rep_unit} onCompleted={startRest} />
          ))}
          <Button size="sm" variant="ghost" onClick={() => addSet(session.id, exercise.id)}>
            <Plus className="h-4 w-4" aria-hidden /> Add set
          </Button>
        </div>
      </Card>

      <ExerciseBody exercise={exercise} />

      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft className="h-4 w-4" aria-hidden /> Previous</Button>
        <Button onClick={() => skipExercise(session, exercise.id)}><SkipForward className="h-4 w-4" aria-hidden /> {skipped ? 'Unskip' : 'Skip'}</Button>
        <Button variant={index === detail.items.length - 1 ? 'primary' : 'secondary'} onClick={() => (index === detail.items.length - 1 ? setFinishing(true) : go(index + 1))}>
          {index === detail.items.length - 1 ? 'Finish' : <>Next <ChevronRight className="h-4 w-4" aria-hidden /></>}
        </Button>
      </div>
      <p className="text-center text-xs text-faint">Every set is saved as you go — you can close the app and resume later.</p>

      {restUntil && <RestTimer until={restUntil} onDone={() => { sessionStorage.removeItem(REST_KEY); setRestUntil(null) }} onAdd={(s) => { const u = restUntil + s * 1000; sessionStorage.setItem(REST_KEY, String(u)); setRestUntil(u) }} />}

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finish workout">
        <div className="space-y-3">
          <p className="text-muted">{totalDone} of {sets.length} sets completed.</p>
          <Field label="Session notes (optional)" htmlFor="session-notes">
            <Textarea id="session-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Any pain or form notes?" />
          </Field>
          <Button variant="primary" size="lg" className="w-full" onClick={async () => { await finishSession(session, notes); sessionStorage.removeItem(REST_KEY); nav(`/workouts/history/${session.id}`, { replace: true }) }}>
            <Check className="h-5 w-5" aria-hidden /> Save workout
          </Button>
          <Button variant="danger" className="w-full" onClick={async () => { if (await confirm({ title: 'Abandon workout?', message: 'Sets you logged are kept, but this session will be marked abandoned rather than completed.', confirmLabel: 'Abandon', destructive: true })) { await abandonSession(session); nav('/workouts', { replace: true }) } }}>
            <X className="h-4 w-4" aria-hidden /> Abandon workout
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function SetRow({ set, unit, onCompleted }: { set: WorkoutSet; unit: 'reps' | 'seconds'; onCompleted: () => void }) {
  const [w, setW] = useState(set.weight_kg?.toString() ?? '')
  const [r, setR] = useState((unit === 'reps' ? set.reps : set.seconds)?.toString() ?? '')
  const commit = (weight: string, reps: string) =>
    updateSet(set.id, unit === 'reps' ? { weight_kg: weight === '' ? null : Number(weight), reps: reps === '' ? null : Number(reps) } : { weight_kg: weight === '' ? null : Number(weight), seconds: reps === '' ? null : Number(reps) })
  const bump = (delta: number) => {
    const next = String(Math.max(0, Math.round(((Number(w) || 0) + delta) * 4) / 4))
    setW(next)
    commit(next, r)
  }
  return (
    <div className={cn('grid grid-cols-[2.5rem_1fr_1fr_3.25rem] items-center gap-2 rounded-xl p-1', set.completed && 'bg-accent/10')}>
      <span className="tnum text-center font-bold">{set.set_number}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Decrease weight for set ${set.set_number}`} className="flex h-11 w-8 items-center justify-center rounded-lg bg-surface-2" onClick={() => bump(-0.5)}><Minus className="h-4 w-4" /></button>
        <input aria-label={`Weight in kg for set ${set.set_number}`} inputMode="decimal" type="number" step="0.25" value={w} onChange={(e) => { setW(e.target.value); commit(e.target.value, r) }} className="tnum min-h-11 w-full min-w-0 rounded-lg border border-line bg-bg px-1 text-center text-lg font-bold" />
        <button type="button" aria-label={`Increase weight for set ${set.set_number}`} className="flex h-11 w-8 items-center justify-center rounded-lg bg-surface-2" onClick={() => bump(0.5)}><Plus className="h-4 w-4" /></button>
      </div>
      <input aria-label={`${unit === 'reps' ? 'Reps' : 'Seconds'} for set ${set.set_number}`} inputMode="numeric" type="number" value={r} onChange={(e) => { setR(e.target.value); commit(w, e.target.value) }} className="tnum min-h-11 w-full min-w-0 rounded-lg border border-line bg-bg px-1 text-center text-lg font-bold" />
      <button
        type="button"
        aria-pressed={set.completed}
        aria-label={`Mark set ${set.set_number} ${set.completed ? 'not done' : 'done'}`}
        onClick={async () => {
          await toggleSetComplete(set)
          if (!set.completed) onCompleted()
        }}
        className={cn('flex h-12 w-12 items-center justify-center rounded-xl border-2', set.completed ? 'border-accent bg-accent text-accent-ink' : 'border-line text-faint')}
      >
        <Check className="h-6 w-6" />
      </button>
    </div>
  )
}

function RestTimer({ until, onDone, onAdd }: { until: number; onDone: () => void; onAdd: (s: number) => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  useEffect(() => {
    if (left === 0) {
      navigator.vibrate?.(200)
      const t = window.setTimeout(onDone, 1500)
      return () => window.clearTimeout(t)
    }
  }, [left, onDone])
  return (
    <div role="timer" aria-live="polite" className="pb-safe fixed inset-x-0 bottom-2 z-30 mx-auto max-w-xl px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-surface p-3 shadow-2xl">
        <Timer className="h-6 w-6 text-accent" aria-hidden />
        <div className="flex-1">
          <p className="text-xs uppercase text-faint">Rest</p>
          <p className="tnum text-2xl font-bold">{left === 0 ? 'Go!' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</p>
        </div>
        <Button size="sm" onClick={() => onAdd(15)}>+15s</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Skip</Button>
      </div>
    </div>
  )
}
