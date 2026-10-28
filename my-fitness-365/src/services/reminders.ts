import { list } from '@/data/repo'
import { shiftDate } from '@/lib/dates'
import type { MeasurementType } from '@/data/types'
import { getSettings } from './profile'

export const MEASUREMENT_FREQUENCY_DAYS: Partial<Record<MeasurementType, number>> = {
  waist_navel: 14,
  chest: 28,
  shoulders: 28,
  arm_left: 28,
  arm_right: 28,
  hips: 28,
  thigh_left: 28,
  thigh_right: 28,
  neck: 28,
}

export interface Reminder {
  kind: 'photo' | 'measurement' | 'weight'
  title: string
  body: string
  to: string
}

export async function reminders(date: string) {
  const [settings, photos, measures, weights] = await Promise.all([getSettings(), list('progress_photos'), list('body_measurements'), list('weight_entries')])
  const out: Reminder[] = []
  if (!weights.some((w) => w.date === date)) out.push({ kind: 'weight', title: 'Weigh in', body: 'No weight recorded today.', to: '/progress/weight?add=1' })

  const lastPhoto = photos.map((p) => p.date).sort().at(-1)
  const photoDue = lastPhoto ? shiftDate(lastPhoto, settings?.photo_interval_days ?? 28) : date
  if (settings?.photo_reminders && photoDue <= date) {
    out.push({ kind: 'photo', title: 'Progress photos due', body: lastPhoto ? `Last set taken ${lastPhoto}.` : 'Take your first front, side and back photos.', to: '/progress/photos/new' })
  }

  const due: { type: MeasurementType; date: string }[] = []
  for (const [type, days] of Object.entries(MEASUREMENT_FREQUENCY_DAYS) as [MeasurementType, number][]) {
    const last = measures.filter((m) => m.type === type).map((m) => m.date).sort().at(-1)
    due.push({ type, date: last ? shiftDate(last, days) : date })
  }
  const nextMeasurementDate = due.map((d) => d.date).sort()[0] ?? date
  if (settings?.measurement_reminders && nextMeasurementDate <= date) {
    const types = due.filter((d) => d.date <= date).length
    out.push({ kind: 'measurement', title: 'Measurements due', body: `${types} measurement${types === 1 ? '' : 's'} due.`, to: '/progress/measurements?add=1' })
  }
  return { reminders: out, nextMeasurementDate, photoDue }
}
