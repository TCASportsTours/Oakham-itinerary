export interface TemplateExerciseSeed {
  exercise: string
  sets: number
  reps_min: number
  reps_max: number
  rep_unit: 'reps' | 'seconds'
  per_side: boolean
  suggested_weight: string
  rest_seconds: number
}

export interface WorkoutSeed {
  key: string
  name: string
  focus: string
  default_weekday: number
  duration_text: string
  exercises: TemplateExerciseSeed[]
}

const ex = (
  exercise: string,
  reps_min: number,
  reps_max: number,
  suggested_weight: string,
  opts: Partial<TemplateExerciseSeed> = {},
): TemplateExerciseSeed => ({
  exercise,
  sets: 2,
  reps_min,
  reps_max,
  rep_unit: 'reps',
  per_side: false,
  suggested_weight,
  rest_seconds: 90,
  ...opts,
})

export const WARMUP = [
  '3–5 minutes of easy movement: marching on the spot, arm circles, or an easy spin on the bike.',
  '10 slow arm swings across the chest and 10 overhead reaches.',
  '10 bodyweight squats to the bench.',
  'One light warm-up set of the first exercise (about half your working weight, 10 reps).',
]

export const SAFETY_NOTES = [
  'Stop the exercise if you feel sharp or pinching pain — discomfort from effort is normal, pain is not.',
  'While learning, finish every set with about 2–3 reps still in reserve. Do not lift to failure.',
  'Rest 60–120 seconds between sets.',
  'Suggested weights are starting suggestions, not prescriptions. Start lighter if in doubt.',
  'Training a muscle does not burn fat from that specific area — fat loss comes from your overall energy balance.',
  'If you have a medical condition, injury or are unsure about exercise, check with a GP or physiotherapist first.',
]

export const RECOVERY_GUIDANCE = [
  'Aim for 7–9 hours of sleep — this is when muscle repair happens.',
  'Keep protein spread across the day (roughly 30–40g per meal).',
  'Gentle walking or a very easy spin helps recovery more than complete inactivity.',
  'Some muscle soreness 24–72 hours after a new exercise is normal and fades as you adapt.',
  'Drink regularly; more on hot days and after long rides.',
]

export const PROGRESSION = [
  { weeks: 'Weeks 1–2', text: 'Introduce the movements. One or two sets. Prioritise technique.' },
  { weeks: 'Weeks 3–4', text: 'Two controlled sets per exercise.' },
  { weeks: 'Weeks 5–6', text: 'Optional third set on the first two exercises if recovery is good.' },
  {
    weeks: 'Weeks 7–8',
    text: 'Gradually increase reps, then weight, when every set reaches the top of the rep range with 2–3 reps in reserve.',
  },
]

export const WORKOUTS: WorkoutSeed[] = [
  {
    key: 'workout_a',
    name: 'Workout A — Chest & Shoulders',
    focus: 'Chest and shoulders',
    default_weekday: 1,
    duration_text: '30–40 minutes',
    exercises: [
      ex('db_flat_press', 10, 12, '4–8kg each'),
      ex('db_incline_press', 10, 12, '4–8kg each'),
      ex('db_seated_shoulder_press', 8, 12, '2.5–5kg each'),
      ex('db_lateral_raise', 12, 15, 'Lightest controllable setting', { rest_seconds: 60 }),
      ex('forearm_plank', 20, 40, 'Bodyweight', { rep_unit: 'seconds', rest_seconds: 60 }),
    ],
  },
  {
    key: 'workout_b',
    name: 'Workout B — Back, Arms & Abs',
    focus: 'Back, arms and abs',
    default_weekday: 3,
    duration_text: '30–40 minutes',
    exercises: [
      ex('db_single_arm_row', 10, 12, '6–10kg', { per_side: true }),
      ex('db_incline_rear_delt_fly', 12, 15, 'Lightest controllable setting', { rest_seconds: 60 }),
      ex('db_hammer_curl', 10, 12, '4–6kg each', { rest_seconds: 60 }),
      ex('reverse_crunch', 10, 15, 'Bodyweight', { rest_seconds: 60 }),
      ex('dead_bug', 8, 8, 'Bodyweight', { per_side: true, rest_seconds: 60 }),
    ],
  },
  {
    key: 'workout_c',
    name: 'Workout C — Chest & Full Body',
    focus: 'Chest and full body',
    default_weekday: 5,
    duration_text: '30–40 minutes',
    exercises: [
      ex('db_incline_press', 10, 12, '4–8kg each'),
      ex('db_chest_supported_row', 10, 12, '5–8kg each'),
      ex('db_goblet_squat', 8, 10, '4–8kg total'),
      ex('db_lateral_raise', 12, 15, 'Lightest controllable setting', { rest_seconds: 60 }),
      ex('side_plank', 20, 30, 'Bodyweight', { rep_unit: 'seconds', per_side: true, rest_seconds: 60 }),
    ],
  },
]
