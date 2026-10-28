import { useState } from 'react'
import { Navigate } from 'react-router'
import { Button, Card, Field, Input, Segmented } from '@/components/ui'
import { WeightInput } from '@/components/WeightInput'
import { ScheduleEditor } from '@/components/ScheduleEditor'
import { Logo } from '@/components/Logo'
import { useProfile, useSettings } from '@/app/session'
import { updateProfile, updateSettings } from '@/services/profile'
import { addWeight } from '@/services/body'
import { today } from '@/lib/dates'
import { formatWeight } from '@/lib/units'
import type { WeightUnit } from '@/data/types'

const STEPS = ['Welcome', 'Profile', 'Current weight', 'Goals', 'Equipment', 'Weekly plan', 'Reminders'] as const

export function Onboarding() {
  const profile = useProfile()
  const settings = useSettings()
  const [step, setStep] = useState(0)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [unit, setUnit] = useState<WeightUnit>('st')

  if (!profile || !settings) return null
  // Redirect once the live profile reflects completion (avoids racing the Gate).
  if (profile.onboarded) return <Navigate to="/" replace />

  const finish = () => updateProfile({ onboarded: true, weight_unit: unit, program_start_date: today() })
  const next = () => (step === STEPS.length - 1 ? finish() : setStep(step + 1))

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <Button variant="ghost" size="sm" onClick={finish}>
          Skip setup
        </Button>
      </div>

      <div className="flex-1 space-y-4">
        {step === 0 && (
          <div className="pt-10 text-center">
            <Logo className="mx-auto h-20 w-20" />
            <h1 className="mt-6 text-4xl">Welcome to My Fitness 365</h1>
            <p className="mt-3 text-muted">Your daily plan, workouts, meals, weight, measurements and private progress photos — in one place. Setup takes about two minutes and everything can be changed later.</p>
          </div>
        )}

        {step === 1 && (
          <Card className="space-y-4">
            <h1 className="text-2xl">Confirm your profile</h1>
            <Field label="Name (for the greeting)" htmlFor="name">
              <Input id="name" defaultValue={profile.display_name} onBlur={(e) => updateProfile({ display_name: e.target.value.trim() })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age" htmlFor="age">
                <Input id="age" type="number" inputMode="numeric" defaultValue={profile.age} onBlur={(e) => updateProfile({ age: Number(e.target.value) || profile.age })} />
              </Field>
              <Field label="Height (cm)" htmlFor="height">
                <Input id="height" type="number" inputMode="decimal" defaultValue={profile.height_cm} onBlur={(e) => updateProfile({ height_cm: Number(e.target.value) || profile.height_cm })} />
              </Field>
            </div>
            <Field label="Sex used for energy estimates" htmlFor="sex">
              <Segmented label="Sex" value={profile.sex} onChange={(v) => updateProfile({ sex: v })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            </Field>
            <p className="text-sm text-faint">Experience: {profile.experience} · Main cardio: {profile.main_cardio} (~{profile.cycling_sessions_per_week} rides/week)</p>
          </Card>
        )}

        {step === 2 && (
          <Card className="space-y-4">
            <h1 className="text-2xl">Today’s weight</h1>
            <p className="text-muted">
              Your starting baseline is {formatWeight(profile.start_weight_kg, 'st')}. Please weigh yourself now (ideally in the morning, after the toilet, before eating) so the app starts from a fresh reading.
            </p>
            <Segmented label="Unit" value={unit} onChange={setUnit} options={[{ value: 'st', label: 'Stones & pounds' }, { value: 'kg', label: 'Kilograms' }]} />
            <WeightInput key={unit} unit={unit} valueKg={null} onChange={setWeightKg} idPrefix="onboard" />
            <Button
              variant="primary"
              className="w-full"
              disabled={!weightKg}
              onClick={async () => {
                await addWeight(today(), weightKg!)
                next()
              }}
            >
              Save weight
            </Button>
          </Card>
        )}

        {step === 3 && (
          <Card className="space-y-4">
            <h1 className="text-2xl">Goals</h1>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First milestone (kg)" htmlFor="target">
                <Input id="target" type="number" step="0.1" defaultValue={profile.target_weight_kg} onBlur={(e) => updateProfile({ target_weight_kg: Number(e.target.value) || profile.target_weight_kg })} />
              </Field>
              <Field label="Starting baseline (kg)" htmlFor="start">
                <Input id="start" type="number" step="0.1" defaultValue={profile.start_weight_kg} onBlur={(e) => updateProfile({ start_weight_kg: Number(e.target.value) || profile.start_weight_kg })} />
              </Field>
              <Field label="Longer-term from (kg)" htmlFor="ltmin">
                <Input id="ltmin" type="number" step="0.5" defaultValue={profile.long_term_min_kg} onBlur={(e) => updateProfile({ long_term_min_kg: Number(e.target.value) || profile.long_term_min_kg })} />
              </Field>
              <Field label="Longer-term to (kg)" htmlFor="ltmax">
                <Input id="ltmax" type="number" step="0.5" defaultValue={profile.long_term_max_kg} onBlur={(e) => updateProfile({ long_term_max_kg: Number(e.target.value) || profile.long_term_max_kg })} />
              </Field>
            </div>
            <p className="text-sm text-faint">Focus: reduce body fat, build chest, shoulders, back and abs, keep riding. The longer-term range is subject to review.</p>
          </Card>
        )}

        {step === 4 && (
          <Card className="space-y-4">
            <h1 className="text-2xl">Equipment</h1>
            <Field label="Equipment" htmlFor="equip">
              <Input id="equip" defaultValue={profile.equipment} onBlur={(e) => updateProfile({ equipment: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heaviest dumbbell (kg each)" htmlFor="maxdb">
                <Input id="maxdb" type="number" defaultValue={profile.max_dumbbell_kg} onBlur={(e) => updateProfile({ max_dumbbell_kg: Number(e.target.value) || profile.max_dumbbell_kg })} />
              </Field>
              <Field label="Gym space" htmlFor="space">
                <Input id="space" defaultValue={profile.gym_space} onBlur={(e) => updateProfile({ gym_space: e.target.value })} />
              </Field>
            </div>
          </Card>
        )}

        {step === 5 && (
          <Card className="space-y-4">
            <h1 className="text-2xl">Your default week</h1>
            <p className="text-sm text-muted">Tap to add or remove. You can move any session in the Diary later without changing this.</p>
            <ScheduleEditor value={settings.weekly_schedule} onChange={(v) => updateSettings({ weekly_schedule: v })} />
          </Card>
        )}

        {step === 6 && (
          <Card className="space-y-4">
            <h1 className="text-2xl">Reminders</h1>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>Progress photo reminder every 4 weeks</span>
              <input type="checkbox" className="h-6 w-6 accent-[#51cea7]" checked={settings.photo_reminders} onChange={(e) => updateSettings({ photo_reminders: e.target.checked })} />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>Measurement reminders (waist fortnightly, others every 4 weeks)</span>
              <input type="checkbox" className="h-6 w-6 accent-[#51cea7]" checked={settings.measurement_reminders} onChange={(e) => updateSettings({ measurement_reminders: e.target.checked })} />
            </label>
            <p className="text-sm text-faint">Reminders appear on your Today screen. Scheduled push notifications to a locked iPhone need a push server and are not set up yet.</p>
          </Card>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button className="flex-1" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        <Button variant={step === 2 ? 'secondary' : 'primary'} className="flex-1" onClick={next}>
          {step === 0 ? 'Get started' : step === STEPS.length - 1 ? 'Open dashboard' : step === 2 ? 'Skip for now' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
