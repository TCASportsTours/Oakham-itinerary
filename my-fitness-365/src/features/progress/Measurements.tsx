import { useState } from 'react'
import { useConfirm } from '@/components/confirm'
import { useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Ruler, Trash2 } from 'lucide-react'
import { Button, Card, Collapsible, Empty, Field, Input, PageHeader, SectionTitle, Segmented, Sheet, Textarea } from '@/components/ui'
import { useProfile } from '@/app/session'
import { addMeasurements, deleteMeasurement, editMeasurement, measurements } from '@/services/body'
import { change } from '@/lib/stats'
import { formatUK, today } from '@/lib/dates'
import { cmToIn, formatLength, inToCm } from '@/lib/units'
import type { BodyMeasurement, LengthUnit, MeasurementType } from '@/data/types'
import { COMMON_TIPS, MEASUREMENTS, TapeIllustration, measurementLabel } from './measurementInfo'
import { PairChart, TrendChart } from './lazyCharts'

export function measurementSummary(all: BodyMeasurement[], type: MeasurementType) {
  const rows = all.filter((m) => m.type === type).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  if (!rows.length) return null
  const baseline = rows[0]
  const latest = rows.at(-1)!
  return { rows, baseline, latest, ...change(baseline.value, latest.value) }
}

export function MeasurementsPage() {
  const confirm = useConfirm()
  const profile = useProfile()
  const all = useLiveQuery(() => measurements(), [])
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<BodyMeasurement | null>(null)
  if (!profile || !all) return null
  const unit = profile.length_unit
  const fmt = (cm: number, t: MeasurementType) => (t === 'body_fat_pct' ? `${cm.toFixed(1)}%` : formatLength(cm, unit))
  const fmtDelta = (cm: number, t: MeasurementType) => {
    const v = t === 'body_fat_pct' ? cm : unit === 'in' ? cmToIn(cm) : cm
    return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}${t === 'body_fat_pct' ? ' pts' : unit}`
  }
  const series = (t: MeasurementType) => (measurementSummary(all, t)?.rows ?? []).map((r) => ({ date: r.date, value: unit === 'in' && t !== 'body_fat_pct' ? cmToIn(r.value) : r.value }))
  const pair = (a: MeasurementType, b: MeasurementType) => {
    const dates = [...new Set(all.filter((m) => m.type === a || m.type === b).map((m) => m.date))].sort()
    const conv = (v?: number) => (v === undefined ? undefined : unit === 'in' ? cmToIn(v) : v)
    return dates.map((d) => ({ date: d, a: conv(all.filter((m) => m.type === a && m.date === d).at(-1)?.value), b: conv(all.filter((m) => m.type === b && m.date === d).at(-1)?.value) }))
  }

  const types: MeasurementType[] = [...MEASUREMENTS.map((m) => m.type), 'body_fat_pct']
  const recorded = types.filter((t) => all.some((m) => m.type === t))

  return (
    <div className="space-y-4">
      <PageHeader title="Measurements" back="/progress" action={<Button variant="primary" onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" aria-hidden /> Add</Button>} />
      <p className="text-sm text-muted">Circumference changes reflect fat, muscle, water and measuring technique together — a single change is not proof of fat loss or muscle gain. Look at trends across several readings.</p>
      {recorded.length === 0 && <Empty icon={<Ruler className="h-8 w-8" />} title="No measurements yet">Tap Add to record your first set. Every field is optional.</Empty>}

      {recorded.map((t) => {
        const s = measurementSummary(all, t)!
        const isArm = t === 'arm_left'
        const isThigh = t === 'thigh_left'
        if (t === 'arm_right' && all.some((m) => m.type === 'arm_left')) return null
        if (t === 'thigh_right' && all.some((m) => m.type === 'thigh_left')) return null
        return (
          <Card key={t}>
            <SectionTitle>{isArm ? 'Upper arms' : isThigh ? 'Thighs' : measurementLabel(t)}</SectionTitle>
            {[t, ...(isArm ? ['arm_right' as const] : isThigh ? ['thigh_right' as const] : [])].map((tt) => {
              const ss = measurementSummary(all, tt)
              if (!ss) return null
              return (
                <div key={tt} className="tnum grid grid-cols-4 gap-2 text-sm">
                  <span className="col-span-4 text-xs font-semibold uppercase text-faint">{measurementLabel(tt)}</span>
                  <span><span className="block text-faint">Baseline</span>{fmt(ss.baseline.value, tt)}</span>
                  <span><span className="block text-faint">Latest</span>{fmt(ss.latest.value, tt)}</span>
                  <span><span className="block text-faint">Change</span>{fmtDelta(ss.abs, tt)}</span>
                  <span><span className="block text-faint">%</span>{ss.rows.length > 1 ? `${ss.pct > 0 ? '+' : ''}${ss.pct.toFixed(1)}%` : '—'}</span>
                </div>
              )
            })}
            <div className="mt-3">
              {isArm || isThigh ? (
                pair(t, isArm ? 'arm_right' : 'thigh_right').length >= 2 ? <PairChart data={pair(t, isArm ? 'arm_right' : 'thigh_right')} unit={unit} aName="Left" bName="Right" /> : <p className="text-sm text-faint">Chart appears after two dates.</p>
              ) : s.rows.length >= 2 ? (
                <TrendChart data={series(t)} unit={t === 'body_fat_pct' ? '%' : unit} name={measurementLabel(t)} height={170} />
              ) : (
                <p className="text-sm text-faint">Chart appears after two readings.</p>
              )}
            </div>
            <Collapsible title={`History (${s.rows.length + (isArm ? measurementSummary(all, 'arm_right')?.rows.length ?? 0 : isThigh ? measurementSummary(all, 'thigh_right')?.rows.length ?? 0 : 0)})`}>
              <ul className="divide-y divide-line">
                {all.filter((m) => m.type === t || (isArm && m.type === 'arm_right') || (isThigh && m.type === 'thigh_right')).sort((a, b) => b.date.localeCompare(a.date)).map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-1.5">
                    <span className="w-24">{formatUK(m.date)}</span>
                    <span className="tnum flex-1 text-ink">{fmt(m.value, m.type)}{(isArm || isThigh) && ` (${m.type.endsWith('left') ? 'L' : 'R'})`}</span>
                    <Button size="icon" variant="ghost" aria-label={`Edit ${measurementLabel(m.type)} on ${formatUK(m.date)}`} onClick={() => setEditing(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${measurementLabel(m.type)} on ${formatUK(m.date)}`} onClick={async () => (await confirm({ title: 'Delete measurement?', message: `${measurementLabel(m.type)} on ${formatUK(m.date)} will be removed.`, confirmLabel: 'Delete', destructive: true })) && deleteMeasurement(m.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </Collapsible>
          </Card>
        )
      })}

      <Card>
        <SectionTitle>How to measure</SectionTitle>
        <div className="space-y-2">
          {MEASUREMENTS.map((m) => (
            <Collapsible key={m.type} title={`${m.label} · ${m.frequency}`}>
              <div className="flex gap-3">
                <TapeIllustration info={m} />
                <div>
                  <p className="font-semibold text-ink">{m.method}</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">{m.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                </div>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">{COMMON_TIPS.map((s) => <li key={s}>{s}</li>)}</ul>
            </Collapsible>
          ))}
          <p className="text-sm text-muted">Weight: digital scales, 3–7 times a week, first thing in the morning after the toilet, before eating or drinking, same clothing.</p>
        </div>
      </Card>

      {params.get('add') === '1' && <AddMeasurements unit={unit} onClose={() => setParams({})} />}
      {editing && <EditMeasurement m={editing} unit={unit} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AddMeasurements({ unit: defaultUnit, onClose }: { unit: LengthUnit; onClose: () => void }) {
  const [unit, setUnit] = useState<LengthUnit>(defaultUnit)
  const [date, setDate] = useState(today())
  const [values, setValues] = useState<Partial<Record<MeasurementType, string>>>({})
  const [notes, setNotes] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const filled = Object.values(values).filter((v) => v && v.trim() !== '').length
  const fields = MEASUREMENTS.filter((m) => showOptional || !m.optional)
  return (
    <Sheet open onClose={onClose} title="Add measurements">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const parsed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v && v.trim() !== '' ? Number(v) : undefined]))
          await addMeasurements(date, parsed, unit, notes)
          onClose()
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="m-date"><Input id="m-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Unit" htmlFor="m-unit"><Segmented label="Unit" value={unit} onChange={setUnit} options={[{ value: 'cm', label: 'cm' }, { value: 'in', label: 'inches' }]} /></Field>
        </div>
        <p className="text-sm text-faint">Fill in only what you measured today — everything is optional.</p>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((m) => (
            <Field key={m.type} label={m.label} htmlFor={`m-${m.type}`}>
              <Input id={`m-${m.type}`} type="number" inputMode="decimal" step="0.1" min="0" value={values[m.type] ?? ''} onChange={(e) => setValues({ ...values, [m.type]: e.target.value })} placeholder={unit} />
            </Field>
          ))}
          {showOptional && (
            <Field label="Est. body fat %" htmlFor="m-bf" hint="Only if measured by a device — the app never estimates this from photos.">
              <Input id="m-bf" type="number" inputMode="decimal" step="0.1" value={values.body_fat_pct ?? ''} onChange={(e) => setValues({ ...values, body_fat_pct: e.target.value })} />
            </Field>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowOptional(!showOptional)}>{showOptional ? 'Hide optional' : 'Show optional (natural waist, calves, body fat)'}</Button>
        <Field label="Notes" htmlFor="m-notes"><Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={filled === 0}>Save {filled || ''} measurement{filled === 1 ? '' : 's'}</Button>
      </form>
    </Sheet>
  )
}

function EditMeasurement({ m, unit, onClose }: { m: BodyMeasurement; unit: LengthUnit; onClose: () => void }) {
  const pct = m.type === 'body_fat_pct'
  const [value, setValue] = useState(String(pct ? m.value : unit === 'in' ? +cmToIn(m.value).toFixed(1) : +m.value.toFixed(1)))
  const [date, setDate] = useState(m.date)
  return (
    <Sheet open onClose={onClose} title={`Edit ${measurementLabel(m.type)}`}>
      <div className="space-y-3">
        <Field label={`Value (${pct ? '%' : unit})`} htmlFor="em-val"><Input id="em-val" type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
        <Field label="Date" htmlFor="em-date"><Input id="em-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Button variant="primary" className="w-full" onClick={async () => {
          const v = Number(value)
          await editMeasurement(m.id, { value: pct ? v : unit === 'in' ? inToCm(v) : v, date })
          onClose()
        }}>Save</Button>
      </div>
    </Sheet>
  )
}
