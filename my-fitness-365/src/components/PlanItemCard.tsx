import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bike, CalendarClock, Check, Dumbbell, GlassWater, Moon, MoreHorizontal, Play, Sofa, X } from 'lucide-react'
import { Badge, Button, Field, Input, Sheet, Textarea } from './ui'
import { cn } from '@/lib/cn'
import { removeActivity, rescheduleActivity, setActivityNotes, setActivityStatus, type PlanItem } from '@/services/diary'
import { startSession } from '@/services/workouts'
import { shiftDate } from '@/lib/dates'
import type { ActivityKind } from '@/data/types'
import { RideSheet } from '@/features/rides/RideSheet'

export const kindIcon: Record<ActivityKind, typeof Dumbbell> = {
  workout: Dumbbell,
  ride: Bike,
  combined: Dumbbell,
  recovery: Sofa,
  rest: Moon,
  social: GlassWater,
}

const statusTone = { planned: 'neutral', completed: 'accent', skipped: 'warn', cancelled: 'danger' } as const

export function PlanItemCard({ item, compact = false }: { item: PlanItem; compact?: boolean }) {
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [ride, setRide] = useState(false)
  const [moveTo, setMoveTo] = useState(shiftDate(item.date, 1))
  const [notes, setNotes] = useState(item.notes)
  const [error, setError] = useState<string | null>(null)
  const Icon = kindIcon[item.kind]
  const inactive = item.status === 'cancelled' || item.status === 'skipped'

  const start = async () => {
    if (item.workout_session_id && item.status !== 'completed') return nav(`/workouts/session/${item.workout_session_id}`)
    if (item.workout_session_id) return nav(`/workouts/history/${item.workout_session_id}`)
    if (!item.workout_template_id) return nav(`/workouts?date=${item.date}`)
    const s = await startSession(item.workout_template_id, item.date, item)
    nav(`/workouts/session/${s.id}`)
  }

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      setMenu(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-surface-2/60 p-3', inactive && 'opacity-60')}>
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', item.status === 'completed' ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-accent')}>
        {item.status === 'completed' ? <Check className="h-5 w-5" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold leading-tight', item.status === 'cancelled' && 'line-through')}>{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone[item.status]}>{item.status[0].toUpperCase() + item.status.slice(1)}</Badge>
          {item.rescheduled_from && <Badge tone="data">Moved from {item.rescheduled_from}</Badge>}
          {!compact && item.notes && <span className="truncate text-xs text-muted">{item.notes}</span>}
        </div>
      </div>
      {item.status === 'planned' && (item.kind === 'workout' || item.kind === 'combined') && (
        <Button size="sm" variant="primary" onClick={start} aria-label={`Start ${item.title}`}>
          <Play className="h-4 w-4" aria-hidden /> {item.workout_session_id ? 'Resume' : 'Start'}
        </Button>
      )}
      {item.status === 'planned' && item.kind === 'ride' && (
        <Button size="sm" variant="primary" onClick={() => setRide(true)} aria-label={`Record ${item.title}`}>
          Record
        </Button>
      )}
      <Button size="icon" variant="ghost" aria-label={`Options for ${item.title}`} onClick={() => setMenu(true)}>
        <MoreHorizontal className="h-5 w-5" />
      </Button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={item.title}>
        <div className="space-y-3">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => act(() => setActivityStatus(item, 'completed'))} disabled={item.status === 'completed'}>
              <Check className="h-4 w-4" aria-hidden /> Mark completed
            </Button>
            <Button onClick={() => act(() => setActivityStatus(item, 'skipped'))} disabled={item.status === 'completed'}>
              Skip
            </Button>
            {item.status !== 'planned' && item.status !== 'completed' && (
              <Button onClick={() => act(() => setActivityStatus(item, 'planned'))}>Restore to planned</Button>
            )}
            <Button variant="danger" onClick={() => act(() => removeActivity(item))} disabled={item.status === 'completed'}>
              <X className="h-4 w-4" aria-hidden /> Remove
            </Button>
          </div>
          <Field label="Reschedule to" htmlFor={`move-${item.id}`}>
            <div className="flex gap-2">
              <Input id={`move-${item.id}`} type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
              <Button onClick={() => act(() => rescheduleActivity(item, moveTo))} disabled={item.status === 'completed' || !moveTo}>
                <CalendarClock className="h-4 w-4" aria-hidden /> Move
              </Button>
            </div>
          </Field>
          <Field label="Notes" htmlFor={`notes-${item.id}`}>
            <Textarea id={`notes-${item.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button className="w-full" onClick={() => act(() => setActivityNotes(item, notes))}>
            Save notes
          </Button>
        </div>
      </Sheet>
      {ride && <RideSheet open={ride} onClose={() => setRide(false)} date={item.date} plan={item} />}
    </div>
  )
}
