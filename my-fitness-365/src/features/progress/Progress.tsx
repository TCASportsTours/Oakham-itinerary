import { useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChevronRight, ClipboardList, Ruler, Scale } from 'lucide-react'
import { Card, Empty, PageHeader, SectionTitle, Segmented, Stat } from '@/components/ui'
import { useProfile } from '@/app/session'
import { weights, measurements } from '@/services/body'
import { photos as listPhotos } from '@/services/photos'
import { RANGES, rangeStart, summariseRange, type RangeKey } from '@/services/review'
import { rollingAverage } from '@/lib/stats'
import { formatUK, today, weekStart, shiftDate } from '@/lib/dates'
import { formatLength, formatWeight, formatWeightDelta, cmToIn } from '@/lib/units'
import { WeightChart } from './lazyCharts'
import { PhotoImg } from './Photos'
import { measurementSummary } from './Measurements'

export function ProgressPage() {
  const profile = useProfile()
  const [range, setRange] = useState<RangeKey>('30d')
  const end = today()
  const data = useLiveQuery(async () => {
    const start = rangeStart(end, range)
    const ws7 = weekStart(end)
    const [ws, ms, ph, summary, week] = await Promise.all([weights(), measurements(), listPhotos(), summariseRange(start, end), summariseRange(ws7, shiftDate(ws7, 6))])
    return { ws, ms, ph, summary, week, start }
  }, [range, end])
  if (!profile || !data) return null
  const unit = profile.weight_unit
  const lu = profile.length_unit
  const pts = data.ws.map((w) => ({ date: w.date, value: w.weight_kg }))
  const avg = rollingAverage(pts)
  const inRange = pts.filter((p) => p.date >= data.start)
  const latest = data.ws.at(-1)
  const s = data.summary
  const delta = (cm: number) => `${cm > 0 ? '+' : cm < 0 ? '−' : '±'}${Math.abs(lu === 'in' ? cmToIn(cm) : cm).toFixed(1)}${lu}`
  const front = data.ph.filter((p) => p.view === 'front').sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-4">
      <PageHeader title="Progress" />
      <Segmented label="Time range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.key, label: r.key === 'all' ? 'All' : r.key.toUpperCase() }))} />

      <div className="grid grid-cols-3 gap-2">
        <NavTile to="/progress/weight" icon={Scale} label="Weight" />
        <NavTile to="/progress/measurements" icon={Ruler} label="Measure" />
        <NavTile to="/progress/photos" icon={Camera} label="Photos" />
      </div>

      <Card>
        <SectionTitle>Body weight</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Current" value={latest ? formatWeight(latest.weight_kg, unit, false) : '—'} sub={latest ? formatUK(latest.date) : 'No entries'} />
          <Stat label="Starting" value={formatWeight(profile.start_weight_kg, unit, false)} sub={`${profile.start_weight_kg}kg baseline`} />
          <Stat label="Change vs start" value={latest ? formatWeightDelta(latest.weight_kg - profile.start_weight_kg, unit) : '—'} />
          <Stat label="7-day average" value={avg.at(-1) ? `${avg.at(-1)!.value.toFixed(1)}kg` : '—'} />
        </div>
        <div className="mt-3">
          {inRange.length >= 2 ? <WeightChart raw={inRange} avg={avg.filter((a) => a.date >= data.start)} target={profile.target_weight_kg} unit="kg" /> : <Empty title="Not enough weigh-ins in this range">Charts show only real entries — two or more are needed.</Empty>}
        </div>
      </Card>

      <Card>
        <SectionTitle>Measurements (all time)</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {(['waist_navel', 'chest', 'shoulders'] as const).map((t) => {
            const ms = measurementSummary(data.ms, t)
            return <Stat key={t} label={t === 'waist_navel' ? 'Waist' : t[0].toUpperCase() + t.slice(1)} value={ms ? formatLength(ms.latest.value, lu) : '—'} sub={ms ? (ms.rows.length > 1 ? `${delta(ms.abs)} since ${formatUK(ms.baseline.date)}` : 'Baseline only') : 'Not measured'} />
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Training & activity ({RANGES.find((r) => r.key === range)!.label})</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Strength sessions this week" value={`${data.week.workoutsCompleted}`} sub="Target 3" />
          <Stat label="Sessions in range" value={`${s.workoutsCompleted}`} sub={s.workoutsPlanned ? `${s.workoutsPlanned} stored as planned` : undefined} />
          <Stat label="Cycling time" value={`${Math.floor(s.rides.minutes / 60)}h ${s.rides.minutes % 60}m`} sub={`${s.rides.count} rides · ${s.rides.km.toFixed(0)} km`} />
          <Stat label="Avg protein / day" value={s.nutrition.avgProtein !== null ? `${Math.round(s.nutrition.avgProtein)}g` : '—'} sub={`${s.nutrition.daysLogged} day(s) with food logged`} />
          <Stat label="Avg food energy / day" value={s.nutrition.avgKcal !== null ? `${Math.round(s.nutrition.avgKcal).toLocaleString('en-GB')} kcal` : '—'} sub="Logged days only" />
          <Stat label="Photos captured" value={`${s.photosCaptured}`} />
        </div>
        {s.strength.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold">Dumbbell improvements</p>
            <ul className="tnum text-sm text-muted">{s.strength.map((x) => <li key={x.name}>{x.name}: {x.from}kg → {x.to}kg</li>)}</ul>
          </div>
        )}
      </Card>

      {front.length >= 2 && (
        <Card>
          <SectionTitle action={<Link to="/progress/photos/compare" className="text-sm font-semibold text-accent">Compare</Link>}>Photo comparison (front)</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {[front[0], front.at(-1)!].map((p) => (
              <figure key={p.id}>
                <PhotoImg photo={p} className="aspect-[3/4] w-full rounded-xl bg-black object-contain" />
                <figcaption className="mt-1 text-sm text-muted">{formatUK(p.date)}</figcaption>
              </figure>
            ))}
          </div>
        </Card>
      )}

      <Link to="/progress/review" className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 hover:bg-surface-2">
        <ClipboardList className="h-6 w-6 text-accent" aria-hidden />
        <span className="flex-1"><span className="block font-semibold">Four-week review</span><span className="block text-sm text-muted">Summary built only from what you recorded</span></span>
        <ChevronRight className="h-5 w-5 text-faint" aria-hidden />
      </Link>
    </div>
  )
}

function NavTile({ to, icon: Icon, label }: { to: string; icon: typeof Scale; label: string }) {
  return (
    <Link to={to} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-surface font-semibold hover:bg-surface-2">
      <Icon className="h-6 w-6 text-accent" aria-hidden />
      {label}
    </Link>
  )
}

export function MonthlyReview() {
  const profile = useProfile()
  const [end, setEnd] = useState(today())
  const start = shiftDate(end, -27)
  const s = useLiveQuery(() => summariseRange(start, end), [start, end])
  if (!s || !profile) return null
  const lu = profile.length_unit
  const cm = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(lu === 'in' ? cmToIn(v) : v).toFixed(1)}${lu}`
  const label = { waist_navel: 'Waist', chest: 'Chest', shoulders: 'Shoulders' } as const
  return (
    <div className="space-y-4">
      <PageHeader title="Four-week review" subtitle={`${formatUK(start)} – ${formatUK(end)}`} back="/progress" />
      <label className="block text-sm text-muted">Review ending
        <input type="date" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink" />
      </label>
      <Card className="space-y-3">
        <Row k="Weight change" v={s.weight && s.weight.entries > 1 ? `${formatWeightDelta(s.weight.change, profile.weight_unit)} (${s.weight.first.toFixed(1)} → ${s.weight.last.toFixed(1)}kg, ${s.weight.entries} weigh-ins)` : 'Not enough data'} />
        {(['waist_navel', 'chest', 'shoulders'] as const).map((t) => {
          const mm = s.measures[t]
          return <Row key={t} k={`${label[t]} change`} v={mm ? (mm.entries > 1 ? `${cm(mm.change)} (${mm.entries} readings)` : 'One reading only') : 'Not measured'} />
        })}
        <Row k="Workouts completed" v={`${s.workoutsCompleted} (of ~12 for 3 a week)`} />
        <Row k="Dumbbell improvements" v={s.strength.length ? s.strength.map((x) => `${x.name} ${x.from}→${x.to}kg`).join('; ') : 'None recorded'} />
        <Row k="Cycling" v={`${s.rides.count} rides · ${Math.floor(s.rides.minutes / 60)}h ${s.rides.minutes % 60}m · ${s.rides.km.toFixed(0)} km`} />
        <Row k="Nutrition logging" v={`${s.nutrition.daysLogged} of 28 days${s.nutrition.avgKcal !== null ? ` · avg ${Math.round(s.nutrition.avgKcal)} kcal, ${Math.round(s.nutrition.avgProtein!)}g protein on logged days` : ''}`} />
        <Row k="Photos captured" v={String(s.photosCaptured)} />
      </Card>
      {s.missing.length > 0 && (
        <Card>
          <SectionTitle>Missing data</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </Card>
      )}
      <p className="text-xs text-faint">Calculated directly from your entries. Trends are not inferred where data is missing, and no body-fat estimate is made from photos.</p>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="tnum text-right font-semibold">{v}</span>
    </div>
  )
}
