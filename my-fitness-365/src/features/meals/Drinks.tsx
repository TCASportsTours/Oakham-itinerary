import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { GlassWater, Trash2 } from 'lucide-react'
import { Button, Card, Field, Input, Progress, SectionTitle, Sheet } from '@/components/ui'
import { alcoholFor, alcoholRange, alcoholTotals, deleteDrink, logDrink } from '@/services/meals'
import { drinkTotals, UK_WEEKLY_UNIT_GUIDELINE } from '@/lib/alcohol'
import { shiftDate, weekStart } from '@/lib/dates'
import type { AlcoholEntry } from '@/data/types'

/** Default: double dark rum and Diet Coke. Never logged automatically. */
const PRESETS = [
  { drink_type: 'Dark rum & Diet Coke (double)', volume_ml: 50, abv: 40, mixer: 'Diet Coke', mixer_kcal: 1 },
  { drink_type: 'Dark rum & Diet Coke (single)', volume_ml: 25, abv: 40, mixer: 'Diet Coke', mixer_kcal: 1 },
  { drink_type: 'Pint of lager (4%)', volume_ml: 568, abv: 4, mixer: '', mixer_kcal: 90 },
  { drink_type: 'Glass of wine (175ml, 12.5%)', volume_ml: 175, abv: 12.5, mixer: '', mixer_kcal: 25 },
]

export function DrinksCard({ date }: { date: string }) {
  const [open, setOpen] = useState(false)
  const data = useLiveQuery(async () => {
    const ws = weekStart(date)
    return { day: await alcoholFor(date), week: await alcoholRange(ws, shiftDate(ws, 6)) }
  }, [date])
  if (!data) return null
  const day = alcoholTotals(data.day)
  const week = alcoholTotals(data.week)
  return (
    <Card>
      <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => setOpen(true)}><GlassWater className="h-4 w-4" aria-hidden /> Add drink</Button>}>Drinks</SectionTitle>
      {data.day.length === 0 ? (
        <p className="text-sm text-faint">No drinks logged for this day.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.day.map((d) => <DrinkRow key={d.id} d={d} />)}
        </ul>
      )}
      <div className="mt-3 space-y-2 text-sm">
        {data.day.length > 0 && (
          <p className="text-muted">
            Today: <span className="tnum font-semibold text-ink">{day.units.toFixed(1)} units</span> · <span className="tnum font-semibold text-ink">{Math.round(day.total_kcal)} kcal</span> ({Math.round(day.alcohol_kcal)} from alcohol + {Math.round(day.mixer_kcal)} from mixers/other)
          </p>
        )}
        <p className="text-muted">
          This week: <span className="tnum font-semibold text-ink">{week.units.toFixed(1)}</span> of the UK low-risk guideline of {UK_WEEKLY_UNIT_GUIDELINE} units
        </p>
        <Progress value={week.units} max={UK_WEEKLY_UNIT_GUIDELINE} label="Weekly alcohol units" tone={week.units > UK_WEEKLY_UNIT_GUIDELINE ? 'warn' : 'data'} />
        {data.day.length > 0 && (
          <p className="text-faint">Recovery: alternate with water, have a glass before bed, and eat your planned meals as normal — there’s no need to skip food to make up for drinks.</p>
        )}
      </div>
      {open && <DrinkSheet open={open} onClose={() => setOpen(false)} date={date} />}
    </Card>
  )
}

function DrinkRow({ d }: { d: AlcoholEntry }) {
  const t = drinkTotals(d)
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">
          {d.quantity} × {d.drink_type}
        </p>
        <p className="tnum text-sm text-muted">
          {d.volume_ml}ml at {d.abv}% · {t.units.toFixed(1)} units · {Math.round(t.total_kcal)} kcal
        </p>
      </div>
      <Button size="icon" variant="ghost" aria-label={`Delete ${d.drink_type}`} onClick={() => deleteDrink(d.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  )
}

function DrinkSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const [form, setForm] = useState({ ...PRESETS[0], quantity: 1 })
  const t = drinkTotals(form)
  const num = (k: 'volume_ml' | 'abv' | 'mixer_kcal' | 'quantity') => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) })
  return (
    <Sheet open={open} onClose={onClose} title="Add drink">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          await logDrink(date, form)
          onClose()
        }}
      >
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button key={p.drink_type} size="sm" onClick={() => setForm({ ...p, quantity: form.quantity })}>
              {p.drink_type}
            </Button>
          ))}
        </div>
        <Field label="Drink" htmlFor="dr-type">
          <Input id="dr-type" value={form.drink_type} onChange={(e) => setForm({ ...form, drink_type: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alcohol volume per drink (ml)" htmlFor="dr-vol"><Input id="dr-vol" type="number" inputMode="decimal" value={form.volume_ml} onChange={num('volume_ml')} /></Field>
          <Field label="ABV (%)" htmlFor="dr-abv"><Input id="dr-abv" type="number" inputMode="decimal" step="0.1" value={form.abv} onChange={num('abv')} /></Field>
          <Field label="Quantity" htmlFor="dr-qty"><Input id="dr-qty" type="number" inputMode="numeric" min={1} value={form.quantity} onChange={num('quantity')} /></Field>
          <Field label="Mixer/other kcal per drink" htmlFor="dr-mix"><Input id="dr-mix" type="number" inputMode="numeric" value={form.mixer_kcal} onChange={num('mixer_kcal')} /></Field>
        </div>
        <p className="tnum text-sm text-muted">
          Units: {form.volume_ml}ml × {form.abv}% ÷ 1000 × {form.quantity} = <span className="font-semibold text-ink">{t.units.toFixed(1)}</span>
          <br />
          Energy: {form.volume_ml}ml × {form.abv / 100} × 0.789 g/ml × 7 kcal/g × {form.quantity} = {Math.round(t.alcohol_kcal)} kcal + mixers {Math.round(t.mixer_kcal)} = <span className="font-semibold text-ink">{Math.round(t.total_kcal)} kcal</span>
        </p>
        <Button type="submit" variant="primary" size="lg" className="w-full">Log drink</Button>
      </form>
    </Sheet>
  )
}
