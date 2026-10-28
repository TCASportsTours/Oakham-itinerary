import { useEffect, useState } from 'react'
import { Input } from './ui'
import { kgToStLb, stLbToKg } from '@/lib/units'
import type { WeightUnit } from '@/data/types'

/** Weight entry in stones + pounds or kg. Always reports kg (or null if incomplete). */
export function WeightInput({ unit, valueKg, onChange, idPrefix = 'weight' }: { unit: WeightUnit; valueKg: number | null; onChange: (kg: number | null) => void; idPrefix?: string }) {
  const init = valueKg ? kgToStLb(valueKg) : null
  const [st, setSt] = useState(init ? String(init.st) : '')
  const [lb, setLb] = useState(init ? String(init.lb) : '')
  const [kg, setKg] = useState(valueKg ? valueKg.toFixed(1) : '')

  useEffect(() => {
    if (unit === 'kg') {
      const v = parseFloat(kg)
      onChange(Number.isFinite(v) && v > 20 && v < 400 ? v : null)
    } else {
      const s = parseFloat(st)
      const l = lb === '' ? 0 : parseFloat(lb)
      onChange(Number.isFinite(s) && Number.isFinite(l) && l >= 0 && l < 14 && s > 2 && s < 60 ? stLbToKg(s, l) : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, st, lb, kg])

  if (unit === 'kg') {
    return (
      <div className="flex items-center gap-2">
        <Input id={`${idPrefix}-kg`} aria-label="Weight in kilograms" inputMode="decimal" type="number" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="88.9" className="text-2xl font-bold" />
        <span className="text-muted">kg</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Input id={`${idPrefix}-st`} aria-label="Stones" inputMode="numeric" type="number" value={st} onChange={(e) => setSt(e.target.value)} placeholder="14" className="text-2xl font-bold" />
      <span className="text-muted">st</span>
      <Input id={`${idPrefix}-lb`} aria-label="Pounds" inputMode="decimal" type="number" step="0.1" value={lb} onChange={(e) => setLb(e.target.value)} placeholder="0" className="text-2xl font-bold" />
      <span className="text-muted">lb</span>
    </div>
  )
}
