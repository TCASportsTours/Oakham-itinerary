import { useRef } from 'react'
import { WeightInput } from './WeightInput'
import { formatWeight } from '@/lib/units'
import type { WeightUnit } from '@/data/types'

/** A saved weight setting (goal, baseline…) entered in the user's unit; saves when focus leaves. */
export function WeightField({ label, unit, valueKg, onSave, id }: { label: string; unit: WeightUnit; valueKg: number; onSave: (kg: number) => void; id: string }) {
  const latest = useRef<number | null>(valueKg)
  return (
    <fieldset
      className="space-y-1.5"
      onBlur={() => {
        const v = latest.current
        if (v !== null && Math.abs(v - valueKg) > 0.01) onSave(Math.round(v * 1000) / 1000)
      }}
    >
      <legend className="mb-1.5 text-sm font-semibold text-muted">{label}</legend>
      <WeightInput key={unit} unit={unit} valueKg={valueKg} onChange={(kg) => (latest.current = kg)} idPrefix={id} />
      <p className="text-xs text-faint">{unit === 'st' ? `${valueKg.toFixed(1)}kg` : formatWeight(valueKg, 'st', false)}</p>
    </fieldset>
  )
}
