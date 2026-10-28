import { useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, BookOpen, Image as ImageIcon, Target, Wind } from 'lucide-react'
import { Badge, Card, Collapsible, PageHeader, SectionTitle } from '@/components/ui'
import { get, list } from '@/data/repo'
import { exerciseHistory } from '@/services/workouts'
import { formatUK } from '@/lib/dates'
import type { Exercise } from '@/data/types'
import { ExerciseImages, ExerciseVideo } from './ExerciseMedia'
import { StrengthChart } from '@/features/progress/lazyCharts'

export function ExerciseBody({ exercise }: { exercise: Exercise }) {
  const all = useLiveQuery(() => list('exercises'), []) ?? []
  const alts = exercise.alternatives.map((k) => all.find((e) => e.key === k)).filter(Boolean) as Exercise[]
  return (
    <div className="space-y-2">
      <Collapsible title="How to perform" icon={<BookOpen className="h-5 w-5 text-accent" aria-hidden />} defaultOpen>
        <p className="mb-1 font-semibold text-ink">Set-up</p>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          {exercise.starting_position.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="mb-1 font-semibold text-ink">Movement</p>
        <ol className="list-decimal space-y-1 pl-5">
          {exercise.instructions.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className="mt-3 flex gap-2"><Wind className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> {exercise.breathing}</p>
      </Collapsible>
      <Collapsible title="Exercise images" icon={<ImageIcon className="h-5 w-5 text-accent" aria-hidden />}>
        <ExerciseImages exercise={exercise} />
      </Collapsible>
      <ExerciseVideo exercise={exercise} />
      <Collapsible title="Common mistakes" icon={<AlertTriangle className="h-5 w-5 text-warn" aria-hidden />}>
        <ul className="list-disc space-y-1 pl-5">
          {exercise.common_mistakes.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="mb-1 mt-3 font-semibold text-ink">Safety</p>
        <ul className="list-disc space-y-1 pl-5">
          {exercise.safety_tips.map((s) => <li key={s}>{s}</li>)}
          <li>Stop if you feel sharp pain.</li>
        </ul>
      </Collapsible>
      <Collapsible title="Muscles worked" icon={<Target className="h-5 w-5 text-accent" aria-hidden />}>
        <p>{exercise.purpose}</p>
        <p className="mt-2"><span className="font-semibold text-ink">Primary:</span> {exercise.primary_muscles.join(', ')}</p>
        <p><span className="font-semibold text-ink">Secondary:</span> {exercise.secondary_muscles.join(', ')}</p>
        <p><span className="font-semibold text-ink">Equipment:</span> {exercise.equipment.join(', ')}</p>
        {alts.length > 0 && <p><span className="font-semibold text-ink">Alternatives:</span> {alts.map((a) => a.name).join(', ')}</p>}
      </Collapsible>
    </div>
  )
}

export function ExerciseDetail() {
  const { id = '' } = useParams()
  const exercise = useLiveQuery(() => get('exercises', id), [id])
  const history = useLiveQuery(() => exerciseHistory(id), [id])
  if (!exercise) return null
  return (
    <div className="space-y-4">
      <PageHeader title={exercise.name} subtitle={<span className="flex flex-wrap gap-1.5"><Badge>{exercise.category}</Badge><Badge>{exercise.difficulty}</Badge><Badge>{exercise.suggested_reps}</Badge></span>} back="/workouts?tab=library" />
      <ExerciseBody exercise={exercise} />
      <Card>
        <SectionTitle>Training history</SectionTitle>
        {!history?.length ? (
          <p className="text-sm text-muted">No completed sets yet.</p>
        ) : (
          <>
            <StrengthChart data={history.map((h) => ({ date: h.date, value: h.topWeight }))} />
            <ul className="mt-3 divide-y divide-line text-sm">
              {[...history].reverse().map((h) => (
                <li key={h.sessionId} className="py-2">
                  <span className="font-semibold">{formatUK(h.date)}</span>{' '}
                  <span className="tnum text-muted">{h.sets.map((s) => `${s.weight_kg ?? 0}kg × ${s.reps ?? s.seconds + 's'}`).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}
