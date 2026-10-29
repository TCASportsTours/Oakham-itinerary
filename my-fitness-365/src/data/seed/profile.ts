import type { Profile, UserSettings } from '../types'

type P = Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
type S = Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>

/** Starting profile from the brief. All editable. Start weight is a baseline, not "current". */
export const DEFAULT_PROFILE = (startDate: string): P => ({
  display_name: '',
  age: 51,
  sex: 'male',
  height_cm: 175,
  start_weight_kg: 88.9,
  target_weight_kg: 83,
  long_term_min_kg: 73,
  long_term_max_kg: 76,
  experience: 'Beginner',
  main_cardio: 'Mountain biking',
  cycling_sessions_per_week: 5,
  ride_kcal_estimate: 1000,
  gym_space: 'Approximately 2m × 2m',
  equipment: 'Adjustable bench; adjustable dumbbells up to 24kg per hand',
  max_dumbbell_kg: 24,
  alcohol_free_days: [0, 1, 2, 3, 5],
  social_days: [4, 6],
  preferred_dinners: 'Mainly chicken and vegetables',
  country: 'United Kingdom',
  weight_unit: 'st',
  length_unit: 'cm',
  time_zone: 'Europe/London',
  onboarded: false,
  program_start_date: startDate,
})

export const DEFAULT_SETTINGS = (schedule: Record<string, string[]>): S => ({
  weekly_schedule: schedule,
  // Provisional starting values from the brief — not validated energy requirements.
  calorie_targets: { cycling: 2600, rest: 2100, social_cycling: 2250, gym: 2300 },
  protein_target_g: 170,
  fat_share: 0.27,
  photo_reminders: true,
  photo_interval_days: 28,
  measurement_reminders: true,
  notifications_enabled: false,
  rest_timer_default_s: 90,
  count_ride_kcal: true,
  ride_kcal_source: 'strava',
  ride_kcal_share: 100,
})
