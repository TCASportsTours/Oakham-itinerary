export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9, alcohol: 7 } as const

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

export const zeroMacros = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 })

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fibre: a.fibre + b.fibre,
  }
}

export const scaleMacros = (m: Macros, f: number): Macros => ({
  kcal: m.kcal * f,
  protein: m.protein * f,
  carbs: m.carbs * f,
  fat: m.fat * f,
  fibre: m.fibre * f,
})

export const kcalFromMacros = (p: number, c: number, f: number) =>
  p * KCAL_PER_G.protein + c * KCAL_PER_G.carbs + f * KCAL_PER_G.fat

/**
 * Split a food-calorie target into grams that reconcile with it.
 * Protein is fixed (g); fat takes `fatShare` of total kcal; carbs fill the rest.
 */
export function macroTargets(foodKcal: number, proteinG: number, fatShare = 0.27) {
  const proteinKcal = proteinG * KCAL_PER_G.protein
  const fatG = (foodKcal * fatShare) / KCAL_PER_G.fat
  const carbKcal = Math.max(0, foodKcal - proteinKcal - fatG * KCAL_PER_G.fat)
  const carbsG = carbKcal / KCAL_PER_G.carbs
  return {
    protein: Math.round(proteinG),
    fat: Math.round(fatG),
    carbs: Math.round(carbsG),
    reconciledKcal: Math.round(kcalFromMacros(proteinG, carbsG, fatG)),
  }
}

export type DayType = 'cycling' | 'rest' | 'social_cycling' | 'gym'

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  cycling: 'Substantial cycling day',
  rest: 'Rest day',
  social_cycling: 'Social + cycling day',
  gym: 'Gym-only day',
}

/** Infer a day type from planned activity kinds; users can override per day. */
export function inferDayType(kinds: string[], rideIntensities: string[]): DayType {
  const hasSubstantialRide = rideIntensities.some((i) => i === 'moderate' || i === 'long')
  const hasRide = rideIntensities.length > 0
  const hasSocial = kinds.includes('social')
  const hasGym = kinds.includes('workout')
  if (hasSocial && hasRide) return 'social_cycling'
  if (hasSubstantialRide) return 'cycling'
  if (hasGym) return 'gym'
  return 'rest'
}
