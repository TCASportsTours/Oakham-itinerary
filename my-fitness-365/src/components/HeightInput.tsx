import { useState } from 'react'
import { Input, Segmented } from './ui'
import { cmToFtIn, ftInToCm } from '@/lib/units'

/**
 * Height in feet + inches (default) or centimetres. Stored in cm.
 * Saves when focus leaves the field, so nothing is written mid-typing.
 */
export function HeightInput({ valueCm, onSave, idPrefix = 'height' }: { valueCm: number; onSave: (cm: number) => void; idPrefix?: string }) {
  const [unit, setUnit] = useState<'ftin' | 'cm'>('ftin')
  const init = cmToFtIn(valueCm)
  const [ft, setFt] = useState(String(init.ft))
  const [inch, setInch] = useState(String(init.inch))
  const [cm, setCm] = useState(String(Math.round(valueCm * 10) / 10))

  const current = () => {
    if (unit === 'cm') {
      const v = parseFloat(cm)
      return v >= 100 && v <= 250 ? v : null
    }
    const f = parseFloat(ft)
    const i = inch === '' ? 0 : parseFloat(inch)
    return f >= 3 && f <= 8 && i >= 0 && i < 12 ? ftInToCm(f, i) : null
  }
  const commit = () => {
    const v = current()
    if (v !== null && Math.abs(v - valueCm) > 0.05) onSave(Math.round(v * 10) / 10)
  }
  const switchUnit = (u: 'ftin' | 'cm') => {
    const v = current() ?? valueCm
    const fi = cmToFtIn(v)
    setFt(String(fi.ft))
    setInch(String(fi.inch))
    setCm(String(Math.round(v * 10) / 10))
    setUnit(u)
  }

  return (
    <div className="space-y-2" onBlur={commit}>
      <Segmented label="Height unit" value={unit} onChange={switchUnit} options={[{ value: 'ftin', label: 'ft & in' }, { value: 'cm', label: 'cm' }]} />
      {unit === 'ftin' ? (
        <div className="flex items-center gap-2">
          <Input id={`${idPrefix}-ft`} aria-label="Feet" type="number" inputMode="numeric" value={ft} onChange={(e) => setFt(e.target.value)} />
          <span className="text-muted">ft</span>
          <Input id={`${idPrefix}-in`} aria-label="Inches" type="number" inputMode="decimal" step="0.5" value={inch} onChange={(e) => setInch(e.target.value)} />
          <span className="text-muted">in</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input id={`${idPrefix}-cm`} aria-label="Height in centimetres" type="number" inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} />
          <span className="text-muted">cm</span>
        </div>
      )}
    </div>
  )
}
