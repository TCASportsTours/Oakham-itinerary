import { create, list, remove, update } from '@/data/repo'
import type { BodyMeasurement, LengthUnit, MeasurementType, WeightEntry } from '@/data/types'
import { inToCm } from '@/lib/units'

export async function weights(): Promise<WeightEntry[]> {
  return (await list('weight_entries')).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
}

export const addWeight = (date: string, weight_kg: number, notes = '') =>
  create('weight_entries', { date, weight_kg: Math.round(weight_kg * 1000) / 1000, notes })

export const editWeight = (id: string, patch: Partial<Pick<WeightEntry, 'date' | 'weight_kg' | 'notes'>>) =>
  update('weight_entries', id, patch)

export const deleteWeight = (id: string) => remove('weight_entries', id)

export async function measurements(): Promise<BodyMeasurement[]> {
  return (await list('body_measurements')).sort((a, b) => a.date.localeCompare(b.date))
}

/** Save only the fields the user filled in (partial entries are fine). Values are stored in cm. */
export async function addMeasurements(
  date: string,
  values: Partial<Record<MeasurementType, number | null | undefined>>,
  unit: LengthUnit,
  notes = '',
) {
  const saved: BodyMeasurement[] = []
  for (const [type, raw] of Object.entries(values) as [MeasurementType, number | null | undefined][]) {
    if (raw === null || raw === undefined || Number.isNaN(raw)) continue
    const isPct = type === 'body_fat_pct'
    saved.push(
      await create('body_measurements', {
        date,
        type,
        value: isPct ? raw : unit === 'in' ? inToCm(raw) : raw,
        entered_unit: isPct ? '%' : unit,
        notes,
      }),
    )
  }
  return saved
}

export const editMeasurement = (id: string, patch: Partial<Pick<BodyMeasurement, 'date' | 'value' | 'notes'>>) =>
  update('body_measurements', id, patch)

export const deleteMeasurement = (id: string) => remove('body_measurements', id)
