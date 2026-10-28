import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Bike, Camera, Dumbbell, Plus, Scale, Settings, Sparkles, Utensils } from 'lucide-react'
import { Button, Card, LinkButton, SectionTitle, Sheet, Stat } from '@/components/ui'
import { PlanItemCard } from '@/components/PlanItemCard'
import { WeightInput } from '@/components/WeightInput'
import { AddFoodSheet, MealPlanDay, NutritionSummary } from '@/features/meals/components'
import { RideSheet } from '@/features/rides/RideSheet'
import { useProfile } from '@/app/session'
import { getDayPlan } from '@/services/diary'
import { getActiveSession, completedSessions, startSession } from '@/services/workouts'
import { weights, measurements, addWeight } from '@/services/body'
import { reminders } from '@/services/reminders'
import { plannedMeals, suggestDay } from '@/services/meals'
import { RECOVERY_GUIDANCE } from '@/data/seed/workouts'
import { formatLong, formatUK, today, weekStart, shiftDate } from '@/lib/dates'
import { formatLength, formatWeight, formatWeightDelta } from '@/lib/units'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Today() {
  const date = today()
  const profile = useProfile()
  const nav = useNavigate()
  const [weighIn, setWeighIn] = useState(false)
  const [food, setFood] = useState(false)
  const [ride, setRide] = useState(false)

  const data = useLiveQuery(async () => {
    const [plan, active, ws, ms, sessions, rem, meals] = await Promise.all([getDayPlan(date), getActiveSession(), weights(), measurements(), completedSessions(), reminders(date), plannedMeals(date)])
    const ws7 = weekStart(date)
    return {
      plan,
      active,
      latestWeight: ws.at(-1),
      latestWaist: ms.filter((m) => m.type === 'waist_navel').at(-1),
      workoutsThisWeek: sessions.filter((s) => s.date >= ws7 && s.date <= shiftDate(ws7, 6)).length,
      rem,
      hasMeals: meals.length > 0,
    }
  }, [date])

  if (!profile || !data) return <p className="pt-safe text-muted">Loading…</p>
  const visible = data.plan.filter((p) => p.status !== 'cancelled')
  const trainingKinds = visible.filter((p) => ['workout', 'ride', 'combined'].includes(p.kind))
  const isRestDay = trainingKinds.length === 0
  const unit = profile.weight_unit
  const change = data.latestWeight ? data.latestWeight.weight_kg - profile.start_weight_kg : null
  const firstWorkout = visible.find((p) => p.kind === 'workout' && p.status === 'planned')

  return (
    <div className="space-y-4">
      <header className="pt-safe flex items-start justify-between gap-3">
        <div>
          <p className="text-muted">{formatLong(date)}</p>
          <h1 className="text-3xl leading-tight">
            {greeting()}
            {profile.display_name ? `, ${profile.display_name}` : ''}
          </h1>
          {change !== null && change < 0 && (
            <p className="mt-1 text-sm text-accent">
              {formatWeightDelta(change, unit)} since your {formatWeight(profile.start_weight_kg, unit, false)} baseline — from your own records.
            </p>
          )}
        </div>
        <LinkButton to="/settings" size="sm" variant="secondary" aria-label="Profile and settings">
          <Settings className="h-5 w-5" aria-hidden />
        </LinkButton>
      </header>

      {data.active && (
        <Card className="border border-accent/40">
          <p className="text-sm text-muted">Workout in progress</p>
          <p className="font-semibold">{data.active.name}</p>
          <LinkButton to={`/workouts/session/${data.active.id}`} variant="primary" className="mt-3 w-full">
            Resume workout
          </LinkButton>
        </Card>
      )}

      {data.rem.reminders.length > 0 && (
        <Card className="space-y-2">
          {data.rem.reminders.map((r) => (
            <Link key={r.kind} to={r.to} className="flex min-h-11 items-center gap-3">
              <Bell className="h-5 w-5 shrink-0 text-warn" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.title}</span>
                <span className="block text-sm text-muted">{r.body}</span>
              </span>
            </Link>
          ))}
        </Card>
      )}

      <Card>
        <SectionTitle action={<LinkButton to={`/diary/${date}`} size="sm" variant="ghost">Edit day</LinkButton>}>Today’s plan</SectionTitle>
        {visible.length === 0 && <p className="text-muted">Nothing planned.</p>}
        <div className="space-y-2">
          {visible.map((p) => (
            <PlanItemCard key={p.id} item={p} compact />
          ))}
        </div>
        {isRestDay && (
          <div className="mt-3 rounded-xl bg-surface-2/60 p-3 text-sm text-muted">
            <p className="mb-1 font-semibold text-ink">Recovery day</p>
            <ul className="list-disc space-y-1 pl-5">
              {RECOVERY_GUIDANCE.slice(0, 3).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => setFood(true)}><Plus className="h-4 w-4" aria-hidden /> Add food</Button>}>Nutrition</SectionTitle>
        <NutritionSummary date={date} />
      </Card>

      <Card>
        <SectionTitle action={<LinkButton to={`/meals?date=${date}`} size="sm" variant="ghost">Planner</LinkButton>}>Meals</SectionTitle>
        {data.hasMeals ? (
          <MealPlanDay date={date} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">No meals planned for today yet.</p>
            <Button variant="primary" className="w-full" onClick={() => suggestDay(date)}>
              <Sparkles className="h-4 w-4" aria-hidden /> Suggest today’s meals
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle action={<LinkButton to="/progress" size="sm" variant="ghost">Progress</LinkButton>}>Progress</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Latest weight" value={data.latestWeight ? formatWeight(data.latestWeight.weight_kg, unit, false) : '—'} sub={data.latestWeight ? `${formatUK(data.latestWeight.date)} · ${data.latestWeight.weight_kg.toFixed(1)}kg` : 'No weigh-ins yet'} />
          <Stat label="vs baseline" value={change !== null ? formatWeightDelta(change, 'kg') : '—'} sub={`Baseline ${formatWeight(profile.start_weight_kg, unit, false)}`} />
          <Stat label="Waist (navel)" value={data.latestWaist ? formatLength(data.latestWaist.value, profile.length_unit) : '—'} sub={data.latestWaist ? formatUK(data.latestWaist.date) : 'Not measured yet'} />
          <Stat label="Strength sessions" value={`${data.workoutsThisWeek} / 3`} sub="This week" />
        </div>
        <p className="mt-3 text-sm text-muted">Next measurements: {formatUK(data.rem.nextMeasurementDate)}</p>
      </Card>

      <section aria-label="Quick actions">
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <QuickAction icon={Dumbbell} label="Start workout" onClick={async () => {
            if (data.active) return nav(`/workouts/session/${data.active.id}`)
            if (firstWorkout?.workout_template_id) {
              const s = await startSession(firstWorkout.workout_template_id, date, firstWorkout)
              return nav(`/workouts/session/${s.id}`)
            }
            nav('/workouts')
          }} />
          <QuickAction icon={Scale} label="Add weight" onClick={() => setWeighIn(true)} />
          <QuickAction icon={Utensils} label="Add meal" onClick={() => setFood(true)} />
          <QuickAction icon={Bike} label="Record ride" onClick={() => setRide(true)} />
          <QuickAction icon={Camera} label="Progress photo" onClick={() => nav('/progress/photos/new')} />
          <QuickAction icon={Plus} label="Measurements" onClick={() => nav('/progress/measurements?add=1')} />
        </div>
      </section>

      <WeighInSheet open={weighIn} onClose={() => setWeighIn(false)} unit={unit} date={date} />
      {food && <AddFoodSheet open={food} onClose={() => setFood(false)} date={date} />}
      {ride && <RideSheet open={ride} onClose={() => setRide(false)} date={date} plan={visible.find((p) => p.kind === 'ride' && p.status === 'planned')} />}
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Dumbbell; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface p-2 text-center text-sm font-semibold hover:bg-surface-2">
      <Icon className="h-6 w-6 text-accent" aria-hidden />
      {label}
    </button>
  )
}

export function WeighInSheet({ open, onClose, unit, date }: { open: boolean; onClose: () => void; unit: 'st' | 'kg'; date: string }) {
  const [kg, setKg] = useState<number | null>(null)
  const [d, setD] = useState(date)
  return (
    <Sheet open={open} onClose={onClose} title="Add weight">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!kg) return
          await addWeight(d, kg)
          onClose()
        }}
      >
        <WeightInput unit={unit} valueKg={null} onChange={setKg} idPrefix="quick" />
        {kg && <p className="text-sm text-muted">= {formatWeight(kg, unit === 'st' ? 'st' : 'kg')}{unit === 'kg' && ` (${formatWeight(kg, 'st', false)})`}</p>}
        <label className="block text-sm text-muted">
          Date
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink" />
        </label>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!kg}>
          Save weight
        </Button>
      </form>
    </Sheet>
  )
}
