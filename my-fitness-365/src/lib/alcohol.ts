/** Ethanol density g/ml and energy per gram (spec: ~7 kcal/g). */
export const ETHANOL_DENSITY = 0.789
export const KCAL_PER_G_ALCOHOL = 7
export const UK_WEEKLY_UNIT_GUIDELINE = 14

/** UK units = volume(ml) × ABV(%) / 1000 */
export const ukUnits = (volumeMl: number, abvPercent: number) => (volumeMl * abvPercent) / 1000

/** Energy from the alcohol itself (excludes sugars / mixers). */
export const alcoholKcal = (volumeMl: number, abvPercent: number) =>
  volumeMl * (abvPercent / 100) * ETHANOL_DENSITY * KCAL_PER_G_ALCOHOL

export interface DrinkLike {
  volume_ml: number
  abv: number
  quantity: number
  mixer_kcal: number
}

export function drinkTotals(d: DrinkLike) {
  const units = ukUnits(d.volume_ml, d.abv) * d.quantity
  const alcohol_kcal = alcoholKcal(d.volume_ml, d.abv) * d.quantity
  const mixer_kcal = d.mixer_kcal * d.quantity
  return { units, alcohol_kcal, mixer_kcal, total_kcal: alcohol_kcal + mixer_kcal }
}
