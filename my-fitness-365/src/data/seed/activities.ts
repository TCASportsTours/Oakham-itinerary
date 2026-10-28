import type { ActivityKind, RideIntensity } from '../types'

export interface ActivitySeed {
  key: string
  name: string
  kind: ActivityKind
  workout?: string
  ride_intensity?: RideIntensity
  duration_min?: number
  description: string
}

export const ACTIVITY_TEMPLATES: ActivitySeed[] = [
  { key: 'workout_a', name: 'Workout A — Chest & Shoulders', kind: 'workout', workout: 'workout_a', duration_min: 35, description: 'Five exercises, about 30–40 minutes.' },
  { key: 'workout_b', name: 'Workout B — Back, Arms & Abs', kind: 'workout', workout: 'workout_b', duration_min: 35, description: 'Five exercises, about 30–40 minutes.' },
  { key: 'workout_c', name: 'Workout C — Chest & Full Body', kind: 'workout', workout: 'workout_c', duration_min: 35, description: 'Five exercises, about 30–40 minutes.' },
  { key: 'ride_easy', name: 'Mountain bike — Easy', kind: 'ride', ride_intensity: 'easy', duration_min: 45, description: 'Conversational pace, recovery spin.' },
  { key: 'ride_moderate', name: 'Mountain bike — Moderate', kind: 'ride', ride_intensity: 'moderate', duration_min: 75, description: 'Steady trail ride with some climbs.' },
  { key: 'ride_long', name: 'Mountain bike — Long/challenging', kind: 'ride', ride_intensity: 'long', duration_min: 150, description: 'Long or hilly ride. Fuel before and during.' },
  { key: 'combined', name: 'Combined gym + cycling', kind: 'combined', duration_min: 90, description: 'Gym session plus a ride. Choose which workout when starting.' },
  { key: 'recovery', name: 'Recovery day', kind: 'recovery', description: 'Gentle walk, mobility, easy spin at most.' },
  { key: 'rest', name: 'Full rest day', kind: 'rest', description: 'No planned training.' },
  { key: 'social', name: 'Social evening', kind: 'social', description: 'Evening out. Log drinks if you choose.' },
]

/** weekday 0=Sun … 6=Sat → template keys (editable in Settings). */
export const DEFAULT_WEEKLY_SCHEDULE: Record<string, string[]> = {
  '1': ['workout_a', 'ride_easy'],
  '2': ['ride_moderate'],
  '3': ['workout_b'],
  '4': ['ride_moderate', 'social'],
  '5': ['workout_c', 'ride_easy'],
  '6': ['recovery', 'social'],
  '0': ['ride_moderate'],
}
