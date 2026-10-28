import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react'
import { Badge, Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Select, Sheet, Textarea } from '@/components/ui'
import { PlanItemCard, kindIcon } from '@/components/PlanItemCard'
import { FoodLogList, MealPlanDay, NutritionSummary } from '@/features/meals/components'
import { DrinksCard } from '@/features/meals/Drinks'
import { useProfile } from '@/app/session'
import { addActivity, copyItinerary, getDayPlan, getDiaryEntry, updateDiary, type PlanItem } from '@/services/diary'
import { forDateRange, list } from '@/data/repo'
import { formatLong, shiftDate, today, weekDates } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { formatWeight } from '@/lib/units'
import { DAY_TYPE_LABEL, type DayType } from '@/lib/nutrition'

async function plansFor(dates: string[]) {
  const out: Record<string, PlanItem[]> = {}
  for (const d of dates) out[d] = await getDayPlan(d)
  return out
}

export function DiaryCalendar() {
  const nav = useNavigate()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(today())
  const t = today()
  const dates =
    view === 'week'
      ? weekDates(anchor)
      : eachDayOfInterval({ start: startOfWeek(startOfMonth(parseISO(anchor)), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(parseISO(anchor)), { weekStartsOn: 1 }) }).map((d) => format(d, 'yyyy-MM-dd'))
  const plans = useLiveQuery(() => plansFor(dates), [dates.join()])
  const step = (dir: 1 | -1) => setAnchor(view === 'week' ? shiftDate(anchor, 7 * dir) : format(addMonths(parseISO(anchor), dir), 'yyyy-MM-dd'))

  return (
    <div>
      <PageHeader title="Diary" subtitle={view === 'week' ? `Week of ${format(parseISO(dates[0]), 'd MMM yyyy')}` : format(parseISO(anchor), 'MMMM yyyy')} />
      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <Segmented label="Calendar view" value={view} onChange={setView} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
        </div>
        <Button size="icon" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => setAnchor(t)}>
        Jump to today
      </Button>

      {view === 'week' ? (
        <ul className="space-y-2">
          {dates.map((d) => {
            const items = (plans?.[d] ?? []).filter((p) => p.status !== 'cancelled')
            return (
              <li key={d}>
                <button type="button" onClick={() => nav(`/diary/${d}`)} className={cn('w-full rounded-2xl bg-surface p-3 text-left hover:bg-surface-2', d === t && 'ring-2 ring-accent')}>
                  <p className="font-semibold">
                    {format(parseISO(d), 'EEEE d MMM')} {d === t && <Badge tone="accent">Today</Badge>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {items.length === 0 && <span className="text-sm text-faint">Nothing planned</span>}
                    {items.map((p) => {
                      const Icon = kindIcon[p.kind]
                      return (
                        <Badge key={p.id} tone={p.status === 'completed' ? 'accent' : p.status === 'skipped' ? 'warn' : 'neutral'}>
                          <Icon className="h-3 w-3" aria-hidden /> {p.title.replace('Mountain bike — ', 'MTB ').replace(/ — .*/, '')}
                          {p.status === 'completed' && ' ✓'}
                        </Badge>
                      )
                    })}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div>
          <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-faint" aria-hidden>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dates.map((d) => {
              const items = (plans?.[d] ?? []).filter((p) => p.status !== 'cancelled')
              const inMonth = d.slice(0, 7) === anchor.slice(0, 7)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => nav(`/diary/${d}`)}
                  aria-label={`${formatLong(d)}: ${items.map((i) => `${i.title} (${i.status})`).join(', ') || 'nothing planned'}`}
                  className={cn('flex aspect-square flex-col items-center justify-start rounded-xl bg-surface p-1 text-sm', !inMonth && 'opacity-40', d === t && 'ring-2 ring-accent')}
                >
                  <span className="tnum font-semibold">{Number(d.slice(8))}</span>
                  <span className="mt-auto flex flex-wrap justify-center gap-0.5 pb-0.5">
                    {items.slice(0, 4).map((p) => (
                      <span key={p.id} className={cn('h-1.5 w-1.5 rounded-full', p.status === 'completed' ? 'bg-accent' : p.kind === 'social' ? 'bg-warn' : p.kind === 'ride' ? 'bg-data' : 'bg-muted')} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-faint">Dots: teal = completed, purple = ride, orange = social, grey = other planned.</p>
        </div>
      )}
    </div>
  )
}

export function DiaryDay() {
  const { date = today() } = useParams()
  const nav = useNavigate()
  const profile = useProfile()
  const [adding, setAdding] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyTo, setCopyTo] = useState(shiftDate(date, 7))
  const data = useLiveQuery(async () => {
    const [plan, entry, templates, weightsToday, rides, sessions] = await Promise.all([
      getDayPlan(date),
      getDiaryEntry(date),
      list('activity_templates'),
      forDateRange('weight_entries', date, date),
      forDateRange('cycling_sessions', date, date),
      forDateRange('workout_sessions', date, date),
    ])
    return { plan, entry, templates, weightsToday, rides, sessions }
  }, [date])
  if (!data || !profile) return null
  const { plan, entry } = data

  return (
    <div className="space-y-4">
      <PageHeader title={formatLong(date)} subtitle={date === today() ? 'Today' : date < today() ? 'Past day' : 'Upcoming'} back="/diary" />
      <div className="flex items-center gap-2">
        <Button size="icon" aria-label="Previous day" onClick={() => nav(`/diary/${shiftDate(date, -1)}`)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button className="flex-1" onClick={() => nav(`/diary/${today()}`)}>
          Today
        </Button>
        <Button size="icon" aria-label="Next day" onClick={() => nav(`/diary/${shiftDate(date, 1)}`)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Card>
        <SectionTitle
          action={
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setCopying(true)}>
                <Copy className="h-4 w-4" aria-hidden /> Copy
              </Button>
              <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </Button>
            </div>
          }
        >
          Activities
        </SectionTitle>
        <div className="space-y-2">
          {plan.length === 0 && <p className="text-muted">Nothing planned.</p>}
          {plan.map((p) => (
            <PlanItemCard key={p.id} item={p} />
          ))}
        </div>
        {(data.rides.length > 0 || data.sessions.length > 0) && (
          <div className="mt-3 space-y-1 text-sm text-muted">
            <p className="font-semibold text-ink">Recorded</p>
            {data.sessions.map((s) => (
              <p key={s.id}>
                {s.name} — {s.status === 'completed' ? 'completed' : s.status === 'in_progress' ? 'in progress' : 'abandoned'}
              </p>
            ))}
            {data.rides.map((r) => (
              <p key={r.id}>
                Ride: {r.duration_min} min{r.distance_km ? ` · ${r.distance_km} km` : ''}{r.est_kcal ? ` · ~${r.est_kcal} kcal (est.)` : ''}
              </p>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Nutrition</SectionTitle>
        <Field label="Calorie target type" htmlFor="daytype" hint="Set automatically from your activities; override if needed.">
          <Select id="daytype" value={entry?.day_type_override ?? ''} onChange={(e) => updateDiary(date, { day_type_override: (e.target.value || null) as DayType | null })}>
            <option value="">Automatic</option>
            {(Object.keys(DAY_TYPE_LABEL) as DayType[]).map((t) => (
              <option key={t} value={t}>
                {DAY_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-3">
          <NutritionSummary date={date} />
        </div>
        <h3 className="mb-2 mt-4 font-semibold">Meal plan</h3>
        <MealPlanDay date={date} />
        <h3 className="mb-2 mt-4 font-semibold">Actually eaten</h3>
        <FoodLogList date={date} />
      </Card>

      <DrinksCard date={date} />

      <Card className="space-y-3">
        <SectionTitle>Notes & wellbeing</SectionTitle>
        {data.weightsToday.length > 0 && <p className="text-sm text-muted">Weight recorded: {data.weightsToday.map((w) => formatWeight(w.weight_kg, profile.weight_unit)).join(', ')}</p>}
        <DiaryNotes key={date} date={date} notes={entry?.notes ?? ''} energy={entry?.energy ?? null} mood={entry?.mood ?? null} sleep={entry?.sleep_hours ?? null} />
      </Card>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add activity">
        <ul className="space-y-2">
          {data.templates.map((t) => {
            const Icon = kindIcon[t.kind]
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2/60 p-3 text-left hover:bg-surface-2"
                  onClick={async () => {
                    await addActivity(date, t)
                    setAdding(false)
                  }}
                >
                  <Icon className="h-5 w-5 text-accent" aria-hidden />
                  <span>
                    <span className="block font-semibold">{t.name}</span>
                    <span className="block text-sm text-muted">{t.description}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>

      <Sheet open={copying} onClose={() => setCopying(false)} title="Copy itinerary">
        <div className="space-y-3">
          <p className="text-sm text-muted">Copies this day’s activities onto another date. Anything already on that date is kept.</p>
          <Field label="Copy to" htmlFor="copy-to">
            <Input id="copy-to" type="date" value={copyTo} onChange={(e) => setCopyTo(e.target.value)} />
          </Field>
          <Button
            variant="primary"
            className="w-full"
            onClick={async () => {
              await copyItinerary(date, copyTo)
              setCopying(false)
              nav(`/diary/${copyTo}`)
            }}
          >
            Copy activities
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function DiaryNotes({ date, notes, energy, mood, sleep }: { date: string; notes: string; energy: number | null; mood: number | null; sleep: number | null }) {
  const [text, setText] = useState(notes)
  const [saved, setSaved] = useState(false)
  return (
    <div className="space-y-3">
      <Field label="Notes" htmlFor="diary-notes">
        <Textarea id="diary-notes" value={text} onChange={(e) => { setText(e.target.value); setSaved(false) }} placeholder="How did today go?" />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Energy (1–5)" htmlFor="energy">
          <Select id="energy" value={energy ?? ''} onChange={(e) => updateDiary(date, { energy: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Mood (1–5)" htmlFor="mood">
          <Select id="mood" value={mood ?? ''} onChange={(e) => updateDiary(date, { mood: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Sleep (h)" htmlFor="sleep">
          <Input id="sleep" type="number" inputMode="decimal" step="0.5" defaultValue={sleep ?? ''} onBlur={(e) => updateDiary(date, { sleep_hours: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      </div>
      <Button
        className="w-full"
        onClick={async () => {
          await updateDiary(date, { notes: text })
          setSaved(true)
        }}
      >
        {saved ? 'Saved ✓' : 'Save notes'}
      </Button>
    </div>
  )
}
