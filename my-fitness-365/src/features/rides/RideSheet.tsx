import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Field, Input, Segmented, Sheet, Textarea } from '@/components/ui'
import { recordRide, editRide } from '@/services/rides'
import { weights } from '@/services/body'
import { useProfile, useSettings } from '@/app/session'
import type { CyclingSession, RideIntensity } from '@/data/types'
import type { PlanItem } from '@/services/diary'

/** Approximate MET values for mountain biking by intensity (Compendium of Physical Activities ranges). */
export const RIDE_MET: Record<RideIntensity, number> = { easy: 6.8, moderate: 8.5, long: 10 }

export function estimateRideKcal(intensity: RideIntensity, weightKg: number, minutes: number) {
  return Math.round(RIDE_MET[intensity] * weightKg * (minutes / 60))
}

export function RideSheet({ open, onClose, date, plan, ride }: { open: boolean; onClose: () => void; date: string; plan?: PlanItem; ride?: CyclingSession }) {
  const profile = useProfile()
  const latestWeight = useLiveQuery(async () => (await weights()).at(-1)?.weight_kg, [])
  const weightKg = latestWeight ?? profile?.start_weight_kg ?? 88.9
  const [intensity, setIntensity] = useState<RideIntensity>(ride?.intensity ?? plan?.ride_intensity ?? 'moderate')
  const [rideDate, setRideDate] = useState(ride?.date ?? date)
  const [start, setStart] = useState(ride?.start_time ?? '')
  const [duration, setDuration] = useState(String(ride?.duration_min ?? (intensity === 'easy' ? 45 : intensity === 'moderate' ? 75 : 150)))
  const [distance, setDistance] = useState(ride?.distance_km != null ? String(ride.distance_km) : '')
  const [elevation, setElevation] = useState(ride?.elevation_m != null ? String(ride.elevation_m) : '')
  const [rpe, setRpe] = useState(String(ride?.rpe ?? ''))
  const [notes, setNotes] = useState(ride?.notes ?? '')
  const [kcal, setKcal] = useState(ride?.est_kcal != null ? String(ride.est_kcal) : '')
  const [kcalTouched, setKcalTouched] = useState(Boolean(ride))

  const settings = useSettings()
  const counted = (settings?.count_ride_kcal ?? true) && (settings?.ride_kcal_source ?? 'strava') === 'all'
  const allowanceNote = counted
    ? `Counted in this day's food allowance (${settings?.ride_kcal_share ?? 100}%).`
    : 'Not added to your food allowance — only Strava rides are counted (change this in Settings).'
  const minutes = Number(duration) || 0
  const estimate = estimateRideKcal(intensity, weightKg, minutes)
  useEffect(() => {
    if (!kcalTouched) setKcal(minutes ? String(estimate) : '')
  }, [estimate, minutes, kcalTouched])

  const save = async () => {
    const input = {
      date: rideDate,
      start_time: start || null,
      duration_min: minutes,
      distance_km: distance ? Number(distance) : null,
      elevation_m: elevation ? Number(elevation) : null,
      est_kcal: kcal ? Number(kcal) : null,
      intensity,
      rpe: rpe ? Math.min(10, Math.max(1, Number(rpe))) : null,
      notes,
      completed: true,
    }
    if (ride) await editRide(ride.id, input)
    else await recordRide(input, plan)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={ride ? 'Edit ride' : 'Record ride'}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Segmented label="Ride type" value={intensity} onChange={setIntensity} options={[{ value: 'easy', label: 'Easy' }, { value: 'moderate', label: 'Moderate' }, { value: 'long', label: 'Long' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="ride-date">
            <Input id="ride-date" type="date" value={rideDate} onChange={(e) => setRideDate(e.target.value)} required />
          </Field>
          <Field label="Start time (optional)" htmlFor="ride-start">
            <Input id="ride-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Duration (min)" htmlFor="ride-duration">
            <Input id="ride-duration" type="number" inputMode="numeric" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </Field>
          <Field label="Distance (km)" htmlFor="ride-distance">
            <Input id="ride-distance" type="number" inputMode="decimal" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </Field>
          <Field label="Elevation gain (m)" htmlFor="ride-elev">
            <Input id="ride-elev" type="number" inputMode="numeric" value={elevation} onChange={(e) => setElevation(e.target.value)} />
          </Field>
          <Field label="Effort 1–10 (RPE)" htmlFor="ride-rpe">
            <Input id="ride-rpe" type="number" inputMode="numeric" min={1} max={10} value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </Field>
        </div>
        <Field
          label="Estimated energy (kcal)"
          htmlFor="ride-kcal"
          hint={`Estimate only: MET ${RIDE_MET[intensity]} × ${weightKg.toFixed(1)}kg × ${(minutes / 60).toFixed(2)}h = ${estimate} kcal. ${allowanceNote}`}
        >
          <Input
            id="ride-kcal"
            type="number"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => {
              setKcalTouched(true)
              setKcal(e.target.value)
            }}
          />
        </Field>
        <Field label="Notes" htmlFor="ride-notes">
          <Textarea id="ride-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!minutes}>
          Save ride
        </Button>
      </form>
    </Sheet>
  )
}
