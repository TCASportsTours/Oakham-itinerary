/**
 * Row types. Field names are snake_case and mirror the Postgres tables in
 * supabase/migrations so a local row can be upserted to the server unchanged.
 */
import type { ISODate } from '@/lib/dates'
import type { DayType } from '@/lib/nutrition'

export interface Row {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type WeightUnit = 'st' | 'kg'
export type LengthUnit = 'cm' | 'in'

export interface Profile extends Row {
  display_name: string
  age: number
  sex: 'male' | 'female'
  height_cm: number
  start_weight_kg: number
  target_weight_kg: number
  long_term_min_kg: number
  long_term_max_kg: number
  experience: string
  main_cardio: string
  cycling_sessions_per_week: number
  ride_kcal_estimate: number
  gym_space: string
  equipment: string
  max_dumbbell_kg: number
  alcohol_free_days: number[]
  social_days: number[]
  preferred_dinners: string
  country: string
  weight_unit: WeightUnit
  length_unit: LengthUnit
  time_zone: string
  onboarded: boolean
  program_start_date: ISODate
}

export interface CalorieTargets {
  cycling: number
  rest: number
  social_cycling: number
  gym: number
}

export interface UserSettings extends Row {
  /** weekday (0=Sun..6=Sat) → activity template keys */
  weekly_schedule: Record<string, string[]>
  calorie_targets: CalorieTargets
  protein_target_g: number
  fat_share: number
  photo_reminders: boolean
  photo_interval_days: number
  measurement_reminders: boolean
  notifications_enabled: boolean
  rest_timer_default_s: number
  /** Add recorded ride calories to the day's food allowance. */
  count_ride_kcal: boolean
  /** Which rides count: only Strava-imported ones, or manual estimates too. */
  ride_kcal_source: 'strava' | 'all'
  /** Percentage of ride calories added (100 = all of them). */
  ride_kcal_share: number
}

export type ActivityKind = 'workout' | 'ride' | 'combined' | 'recovery' | 'rest' | 'social'
export type RideIntensity = 'easy' | 'moderate' | 'long'

export interface ActivityTemplate extends Row {
  key: string
  name: string
  kind: ActivityKind
  workout_template_id: string | null
  ride_intensity: RideIntensity | null
  duration_min: number | null
  description: string
}

export type ActivityStatus = 'planned' | 'completed' | 'skipped' | 'cancelled'

export interface ScheduledActivity extends Row {
  date: ISODate
  template_id: string | null
  title: string
  kind: ActivityKind
  workout_template_id: string | null
  ride_intensity: RideIntensity | null
  status: ActivityStatus
  workout_session_id: string | null
  cycling_session_id: string | null
  rescheduled_from: ISODate | null
  notes: string
  position: number
}

export interface DiaryEntry extends Row {
  date: ISODate
  notes: string
  energy: number | null
  mood: number | null
  sleep_hours: number | null
  plan_materialised: boolean
  day_type_override: DayType | null
}

export interface Exercise extends Row {
  key: string
  name: string
  category: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  starting_position: string[]
  instructions: string[]
  breathing: string
  common_mistakes: string[]
  safety_tips: string[]
  suggested_reps: string
  purpose: string
  alternatives: string[]
  tags: string[]
  /** Only a URL that has been checked by a person; null = unavailable. */
  video_url: string | null
  video_source: string | null
  video_verified: boolean
  illustration: string | null
}

export interface ExerciseMedia extends Row {
  exercise_id: string
  kind: 'image'
  label: 'start' | 'finish' | 'other'
  storage: 'local' | 'cloud' | 'url'
  url: string | null
  source: string
}

export interface WorkoutTemplate extends Row {
  key: string
  name: string
  focus: string
  default_weekday: number
  duration_text: string
  warmup: string[]
  notes: string
}

export interface WorkoutTemplateExercise extends Row {
  template_id: string
  exercise_id: string
  position: number
  sets: number
  reps_min: number
  reps_max: number
  rep_unit: 'reps' | 'seconds'
  per_side: boolean
  suggested_weight: string
  rest_seconds: number
}

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned'

export interface WorkoutSession extends Row {
  date: ISODate
  template_id: string
  name: string
  status: SessionStatus
  started_at: string
  finished_at: string | null
  current_index: number
  scheduled_activity_id: string | null
  skipped_exercise_ids: string[]
  notes: string
}

export interface WorkoutSet extends Row {
  session_id: string
  exercise_id: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  seconds: number | null
  completed: boolean
  completed_at: string | null
}

export interface CyclingSession extends Row {
  date: ISODate
  start_time: string | null
  duration_min: number
  distance_km: number | null
  elevation_m: number | null
  est_kcal: number | null
  intensity: RideIntensity
  rpe: number | null
  notes: string
  completed: boolean
  scheduled_activity_id: string | null
  /** 'strava' rows were imported; est_kcal is then Strava's own calorie figure. */
  source: 'manual' | 'strava'
  external_id: string | null
  avg_hr: number | null
}

export type IngredientCategory =
  | 'Meat and fish'
  | 'Vegetables'
  | 'Fruit'
  | 'Dairy and eggs'
  | 'Rice, pasta and grains'
  | 'Tinned and packaged food'
  | 'Herbs, spices and sauces'
  | 'Other'

export interface Ingredient extends Row {
  key: string
  name: string
  category: IngredientCategory
  /** Per 100g as weighed (see `state`). */
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  state: 'raw' | 'cooked' | 'dry' | 'as sold'
  source: string
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Recipe extends Row {
  key: string
  name: string
  meal_type: MealSlot
  prep_min: number
  cook_min: number
  portions: number
  instructions: string[]
  tags: string[]
  favourite: boolean
  image_url: string | null
  notes: string
}

export interface RecipeIngredient extends Row {
  recipe_id: string
  ingredient_id: string
  /** Grams for the whole recipe (all portions), weighed in the ingredient's state. */
  grams: number
  note: string
  position: number
}

export interface PlannedMeal extends Row {
  date: ISODate
  slot: MealSlot
  recipe_id: string | null
  custom_name: string | null
  portions: number
  position: number
}

export interface FoodLogEntry extends Row {
  date: ISODate
  slot: MealSlot | 'ride'
  recipe_id: string | null
  planned_meal_id: string | null
  name: string
  portions: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  during_ride: boolean
  logged_at: string
}

export interface AlcoholEntry extends Row {
  date: ISODate
  drink_type: string
  volume_ml: number
  abv: number
  quantity: number
  mixer: string
  mixer_kcal: number
  logged_at: string
}

export interface ShoppingList extends Row {
  name: string
  start_date: ISODate
  end_date: ISODate
  generated_at: string
}

export interface ShoppingListItem extends Row {
  list_id: string
  name: string
  category: IngredientCategory
  quantity_g: number | null
  quantity_text: string
  checked: boolean
  manual: boolean
  ingredient_id: string | null
}

export interface WeightEntry extends Row {
  date: ISODate
  weight_kg: number
  notes: string
}

export type MeasurementType =
  | 'waist_navel'
  | 'chest'
  | 'shoulders'
  | 'arm_left'
  | 'arm_right'
  | 'hips'
  | 'thigh_left'
  | 'thigh_right'
  | 'neck'
  | 'waist_natural'
  | 'calf_left'
  | 'calf_right'
  | 'body_fat_pct'

export interface BodyMeasurement extends Row {
  date: ISODate
  type: MeasurementType
  /** cm for circumferences, % for body_fat_pct */
  value: number
  entered_unit: LengthUnit | '%'
  notes: string
}

export type PhotoView = 'front' | 'side' | 'back'

export interface ProgressPhoto extends Row {
  date: ISODate
  view: PhotoView
  storage: 'local' | 'cloud'
  storage_path: string | null
  width: number
  height: number
  mime: string
  notes: string
  uploaded: boolean
}

export interface AppNotification extends Row {
  kind: 'photo' | 'measurement' | 'weight' | 'general'
  title: string
  body: string
  due_date: ISODate
  dismissed_at: string | null
}

/** Local-only queue of mutations waiting to reach Supabase. */
export interface SyncOperation {
  id: string
  table: SyncedTable
  record_id: string
  op: 'upsert'
  payload: Row
  /** Seeded rows must never overwrite a server copy the user may have edited. */
  seed: boolean
  created_at: string
  attempts: number
  last_error: string | null
}

/** Local-only binary store (photos, user exercise images). Never synced as rows. */
export interface LocalBlob {
  id: string
  user_id: string
  blob: Blob
  created_at: string
}

export interface MetaRow {
  key: string
  value: unknown
}

export const SYNCED_TABLES = [
  'profiles',
  'user_settings',
  'activity_templates',
  'scheduled_activities',
  'diary_entries',
  'exercises',
  'exercise_media',
  'workout_templates',
  'workout_template_exercises',
  'workout_sessions',
  'workout_sets',
  'cycling_sessions',
  'ingredients',
  'recipes',
  'recipe_ingredients',
  'planned_meals',
  'food_log_entries',
  'alcohol_entries',
  'shopping_lists',
  'shopping_list_items',
  'weight_entries',
  'body_measurements',
  'progress_photos',
  'notifications',
] as const

export type SyncedTable = (typeof SYNCED_TABLES)[number]

export interface TableRowMap {
  profiles: Profile
  user_settings: UserSettings
  activity_templates: ActivityTemplate
  scheduled_activities: ScheduledActivity
  diary_entries: DiaryEntry
  exercises: Exercise
  exercise_media: ExerciseMedia
  workout_templates: WorkoutTemplate
  workout_template_exercises: WorkoutTemplateExercise
  workout_sessions: WorkoutSession
  workout_sets: WorkoutSet
  cycling_sessions: CyclingSession
  ingredients: Ingredient
  recipes: Recipe
  recipe_ingredients: RecipeIngredient
  planned_meals: PlannedMeal
  food_log_entries: FoodLogEntry
  alcohol_entries: AlcoholEntry
  shopping_lists: ShoppingList
  shopping_list_items: ShoppingListItem
  weight_entries: WeightEntry
  body_measurements: BodyMeasurement
  progress_photos: ProgressPhoto
  notifications: AppNotification
}
