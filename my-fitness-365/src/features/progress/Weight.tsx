import { useState } from 'react'
import { useConfirm } from '@/components/confirm'
import { useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Empty, Field, Input, PageHeader, Progress, SectionTitle, Sheet, Stat } from '@/components/ui'
import { WeightInput } from '@/components/WeightInput'
import { WeighInSheet } from '@/features/today/Today'
import { useProfile } from '@/app/session'
import { deleteWeight, editWeight, weights } from '@/services/body'
import { rollingAverage, valueAtOrBefore } from '@/lib/stats'
import { formatUK, shiftDate, today } from '@/lib/dates'
import { formatWeight, formatWeightDelta } from '@/lib/units'
import type { WeightEntry } from '@/data/types'
import { WeightChart } from './lazyCharts'

export function weightStats(ws: WeightEntry[], startKg: number, targetKg: number) {
  const pts = ws.map((w) => ({ date: w.date, value: w.weight_kg }))
  const avg = rollingAverage(pts)
  const latest = ws.at(-1)
  const t = today()
  const change = (days: number) => {
    if (!latest) return null
    const then = valueAtOrBefore(pts, shiftDate(latest.date, -days))
    return then ? latest.weight_kg - then.value : null
  }
  const toGo = latest ? latest.weight_kg - targetKg : null
  const progressPct = latest ? Math.max(0, Math.min(100, ((startKg - latest.weight_kg) / (startKg - targetKg)) * 100)) : 0
  return { pts, avg, latest, avg7: avg.at(-1), change30: change(30), change90: change(90), total: latest ? latest.weight_kg - startKg : null, toGo, progressPct, stale: latest ? latest.date < shiftDate(t, -7) : false }
}

export function WeightPage() {
  const confirm = useConfirm()
  const profile = useProfile()
  const [params, setParams] = useSearchParams()
  const ws = useLiveQuery(() => weights(), [])
  const [editing, setEditing] = useState<WeightEntry | null>(null)
  if (!profile || !ws) return null
  const unit = profile.weight_unit
  const s = weightStats(ws, profile.start_weight_kg, profile.target_weight_kg)
  return (
    <div className="space-y-4">
      <PageHeader title="Weight" back="/progress" action={<Button variant="primary" onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" aria-hidden /> Add</Button>} />
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Current" value={s.latest ? formatWeight(s.latest.weight_kg, unit, false) : '—'} sub={s.latest ? `${s.latest.weight_kg.toFixed(1)}kg · ${formatUK(s.latest.date)}` : 'No entries'} />
          <Stat label="Starting baseline" value={formatWeight(profile.start_weight_kg, unit, false)} sub={`${profile.start_weight_kg.toFixed(1)}kg`} />
          <Stat label="7-day average" value={s.avg7 ? `${s.avg7.value.toFixed(1)}kg` : '—'} sub="Mean of weigh-ins in the last 7 days" />
          <Stat label="Total change" value={s.total !== null ? formatWeightDelta(s.total, 'kg') : '—'} sub="Latest minus baseline" />
          <Stat label="30 days" value={s.change30 !== null ? formatWeightDelta(s.change30, 'kg') : '—'} sub={s.change30 === null ? 'Needs an entry ≥30 days old' : undefined} />
          <Stat label="90 days" value={s.change90 !== null ? formatWeightDelta(s.change90, 'kg') : '—'} sub={s.change90 === null ? 'Needs an entry ≥90 days old' : undefined} />
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-sm text-muted">
            Milestone {formatWeight(profile.target_weight_kg, unit, false)}
            {s.toGo !== null && (s.toGo > 0 ? ` · ${s.toGo.toFixed(1)}kg to go` : ' · reached')}
          </p>
          <Progress value={s.progressPct} max={100} label="Progress to first milestone" />
          <p className="text-xs text-faint">Progress = (baseline − current) ÷ (baseline − milestone).</p>
        </div>
      </Card>
      <Card>
        <SectionTitle>Trend</SectionTitle>
        {ws.length >= 2 ? (
          <WeightChart raw={s.pts} avg={s.avg} target={profile.target_weight_kg} unit="kg" />
        ) : (
          <Empty title="Not enough data yet">The chart appears once you have two or more weigh-ins.</Empty>
        )}
      </Card>
      <Card>
        <SectionTitle>History</SectionTitle>
        <ul className="divide-y divide-line">
          {[...ws].reverse().map((w) => (
            <li key={w.id} className="flex items-center gap-2 py-2">
              <span className="w-24 text-sm text-muted">{formatUK(w.date)}</span>
              <span className="tnum flex-1 font-semibold">{formatWeight(w.weight_kg, unit)}</span>
              <Button size="icon" variant="ghost" aria-label={`Edit weight on ${formatUK(w.date)}`} onClick={() => setEditing(w)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Delete weight on ${formatUK(w.date)}`} onClick={async () => (await confirm({ title: 'Delete weight?', message: `The entry for ${formatUK(w.date)} will be removed.`, confirmLabel: 'Delete', destructive: true })) && deleteWeight(w.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
        {!ws.length && <p className="text-sm text-muted">No weigh-ins recorded.</p>}
      </Card>
      <WeighInSheet open={params.get('add') === '1'} onClose={() => setParams({})} unit={unit} date={today()} />
      {editing && <EditWeight entry={editing} unit={unit} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditWeight({ entry, unit, onClose }: { entry: WeightEntry; unit: 'st' | 'kg'; onClose: () => void }) {
  const [kg, setKg] = useState<number | null>(entry.weight_kg)
  const [date, setDate] = useState(entry.date)
  return (
    <Sheet open onClose={onClose} title="Edit weight">
      <div className="space-y-3">
        <WeightInput unit={unit} valueKg={entry.weight_kg} onChange={setKg} idPrefix="edit" />
        <Field label="Date" htmlFor="edit-date"><Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Button variant="primary" className="w-full" disabled={!kg} onClick={async () => { await editWeight(entry.id, { weight_kg: kg!, date }); onClose() }}>Save</Button>
      </div>
    </Sheet>
  )
}
