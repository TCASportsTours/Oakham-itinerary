import { create, forDate, forDateRange, list, remove, update } from '@/data/repo'
import { nowIso, shiftDate } from '@/lib/dates'
import { addMacros, inferDayType, macroTargets, scaleMacros, zeroMacros, type DayType, type Macros } from '@/lib/nutrition'
import { drinkTotals } from '@/lib/alcohol'
import type {
  AlcoholEntry,
  FoodLogEntry,
  Ingredient,
  IngredientCategory,
  MealSlot,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
} from '@/data/types'
import { getDayPlan, getDiaryEntry } from './diary'
import { getSettings } from './profile'

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const SLOT_LABEL: Record<MealSlot | 'ride', string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  ride: 'On the bike',
}

export interface Catalogue {
  recipes: Recipe[]
  ingredients: Map<string, Ingredient>
  byRecipe: Map<string, RecipeIngredient[]>
}

export async function loadCatalogue(): Promise<Catalogue> {
  const [recipes, ingredients, ris] = await Promise.all([list('recipes'), list('ingredients'), list('recipe_ingredients')])
  const byRecipe = new Map<string, RecipeIngredient[]>()
  for (const ri of ris) byRecipe.set(ri.recipe_id, [...(byRecipe.get(ri.recipe_id) ?? []), ri])
  for (const v of byRecipe.values()) v.sort((a, b) => a.position - b.position)
  return { recipes: recipes.sort((a, b) => a.name.localeCompare(b.name)), ingredients: new Map(ingredients.map((i) => [i.id, i])), byRecipe }
}

/** Macros for ONE serving, computed from ingredient grams × per-100g values. */
export function recipeMacros(cat: Catalogue, recipe: Recipe): Macros {
  let total = zeroMacros()
  for (const ri of cat.byRecipe.get(recipe.id) ?? []) {
    const ing = cat.ingredients.get(ri.ingredient_id)
    if (!ing) continue
    total = addMacros(total, scaleMacros({ kcal: ing.kcal, protein: ing.protein, carbs: ing.carbs, fat: ing.fat, fibre: ing.fibre }, ri.grams / 100))
  }
  return scaleMacros(total, 1 / Math.max(1, recipe.portions))
}

// ── Day targets ────────────────────────────────────────────────────
export async function dayType(date: string): Promise<DayType> {
  const entry = await getDiaryEntry(date)
  if (entry?.day_type_override) return entry.day_type_override
  const plan = (await getDayPlan(date)).filter((p) => p.status !== 'cancelled' && p.status !== 'skipped')
  return inferDayType(
    plan.map((p) => (p.kind === 'combined' ? 'workout' : p.kind)),
    plan.filter((p) => p.ride_intensity || p.kind === 'combined').map((p) => p.ride_intensity ?? 'easy'),
  )
}

export interface RideCredit {
  name: string
  kcal: number
  source: 'strava' | 'manual'
}

/**
 * Food target for a date.
 * Without counted rides: the planned day type's target (cycling days already allow for riding).
 * With counted rides recorded: the day's non-riding base (gym or rest) plus the ride calories
 * (× the chosen share), so riding is never counted twice.
 */
export async function dayTargets(date: string) {
  const settings = await getSettings()
  const targets = settings?.calorie_targets ?? { cycling: 2600, rest: 2100, social_cycling: 2250, gym: 2300 }
  const type = await dayType(date)
  const protein = settings?.protein_target_g ?? 170
  const fatShare = settings?.fat_share ?? 0.27

  const countRides = settings?.count_ride_kcal ?? true
  const onlyStrava = (settings?.ride_kcal_source ?? 'strava') === 'strava'
  const share = (settings?.ride_kcal_share ?? 100) / 100
  const rides = countRides
    ? (await forDate('cycling_sessions', date)).filter((r) => r.completed && r.est_kcal && (!onlyStrava || r.source === 'strava'))
    : []
  const rideCredits: RideCredit[] = rides.map((r) => ({ name: r.notes || `${r.duration_min} min ride`, kcal: Math.round((r.est_kcal ?? 0) * share), source: r.source ?? 'manual' }))

  if (!rideCredits.length) {
    const kcal = targets[type]
    return { type, kcal, base: { type, kcal }, rideCredits, ...macroTargets(kcal, protein, fatShare) }
  }
  const entry = await getDiaryEntry(date)
  const plan = (await getDayPlan(date)).filter((p) => p.status !== 'cancelled' && p.status !== 'skipped')
  const baseType: DayType =
    entry?.day_type_override === 'rest' || entry?.day_type_override === 'gym'
      ? entry.day_type_override
      : inferDayType(plan.filter((p) => p.kind !== 'ride').map((p) => (p.kind === 'combined' ? 'workout' : p.kind)), [])
  const base = targets[baseType]
  const kcal = base + rideCredits.reduce((t, c) => t + c.kcal, 0)
  return { type, kcal, base: { type: baseType, kcal: base }, rideCredits, ...macroTargets(kcal, protein, fatShare) }
}

// ── Planning ───────────────────────────────────────────────────────
export async function plannedMeals(date: string): Promise<PlannedMeal[]> {
  return (await forDate('planned_meals', date)).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position)
}

export const planMeal = (date: string, slot: MealSlot, recipe_id: string, portions = 1, position = 0) =>
  create('planned_meals', { date, slot, recipe_id, custom_name: null, portions, position })

export const updatePlannedMeal = (id: string, patch: Partial<Pick<PlannedMeal, 'recipe_id' | 'portions' | 'slot'>>) =>
  update('planned_meals', id, patch)

export const removePlannedMeal = (id: string) => remove('planned_meals', id)

/** Simple deterministic pseudo-random from a string so suggestions are stable per date. */
function seeded(str: string) {
  let h = 2166136261
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h >>>= 0) % 10000) / 10000
  }
}

/**
 * Choose a recipe for a slot. Prefers favourites and chicken-and-veg dinners,
 * avoids recipes used in `recent`, favours carb-friendly options on cycling days.
 */
export function chooseRecipe(cat: Catalogue, slot: MealSlot, opts: { recent: string[]; cycling: boolean; seed: string; exclude?: string }) {
  const rand = seeded(opts.seed)
  const pool = cat.recipes.filter((r) => r.meal_type === slot && r.id !== opts.exclude)
  const weight = (r: Recipe) => {
    let w = 1
    if (r.favourite) w += 2
    if (slot === 'dinner' && r.tags.includes('chicken & veg')) w += 2
    if (opts.cycling && (r.tags.includes('cycling day') || r.tags.includes('pre-ride'))) w += 1.5
    if (opts.recent.includes(r.id)) w *= 0.1
    return w
  }
  const total = pool.reduce((t, r) => t + weight(r), 0)
  let pick = rand() * total
  for (const r of pool) {
    pick -= weight(r)
    if (pick <= 0) return r
  }
  return pool[0]
}

/** Fill any empty slots on a date with suggestions. Existing choices are never replaced. */
export async function suggestDay(date: string, cat?: Catalogue) {
  cat ??= await loadCatalogue()
  const existing = await plannedMeals(date)
  const recentMeals = await forDateRange('planned_meals', shiftDate(date, -3), shiftDate(date, -1))
  const recent = recentMeals.map((m) => m.recipe_id!).filter(Boolean)
  const type = await dayType(date)
  const cycling = type === 'cycling' || type === 'social_cycling'
  // Choose recipes first, then size portions to the day's calorie target.
  const picks: { slot: MealSlot; recipe: Recipe; portions: number; position: number }[] = []
  for (const slot of SLOTS) {
    if (existing.some((m) => m.slot === slot)) continue
    const count = slot === 'snack' ? (cycling ? 2 : 1) : 1
    for (let i = 0; i < count; i++) {
      const r = chooseRecipe(cat, slot, { recent: [...recent, ...picks.map((c) => c.recipe.id)], cycling, seed: `${date}:${slot}:${i}` })
      if (r) picks.push({ slot, recipe: r, portions: 1, position: i })
    }
  }
  const { kcal: target } = await dayTargets(date)
  const kcalOf = (r: Recipe) => recipeMacros(cat!, r).kcal
  const existingKcal = existing.reduce((t, m) => {
    const r = cat!.recipes.find((x) => x.id === m.recipe_id)
    return t + (r ? kcalOf(r) * m.portions : 0)
  }, 0)
  sizeToTarget(picks, target - existingKcal, kcalOf, (slot, i) => chooseRecipe(cat!, slot, { recent: [...recent, ...picks.map((c) => c.recipe.id)], cycling, seed: `${date}:${slot}:extra${i}` }))
  const created: PlannedMeal[] = []
  for (const p of picks) created.push(await planMeal(date, p.slot, p.recipe.id, p.portions, p.position))
  return created
}

/**
 * Bring a set of new picks close to a calorie budget without overshooting by much:
 * 1) add up to two extra snacks while the gap is > 300 kcal,
 * 2) then raise main-meal portions in 0.25 steps (max 1.5×) while the gap is > 150 kcal.
 * Mutates `picks`. Rules are deliberately simple so the result is easy to explain.
 */
export function sizeToTarget(
  picks: { slot: MealSlot; recipe: Recipe; portions: number; position: number }[],
  budget: number,
  kcalOf: (r: Recipe) => number,
  extraSnack: (slot: MealSlot, i: number) => Recipe | undefined,
) {
  if (!picks.length) return
  const total = () => picks.reduce((t, p) => t + kcalOf(p.recipe) * p.portions, 0)
  for (let i = 0; i < 2 && budget - total() > 300; i++) {
    const r = extraSnack('snack', i)
    if (!r) break
    picks.push({ slot: 'snack', recipe: r, portions: 1, position: picks.filter((p) => p.slot === 'snack').length })
  }
  const mains = picks.filter((p) => p.slot === 'dinner' || p.slot === 'lunch' || p.slot === 'breakfast').sort((a, b) => kcalOf(b.recipe) - kcalOf(a.recipe))
  let changed = true
  while (changed && budget - total() > 150) {
    changed = false
    for (const m of mains) {
      if (budget - total() <= 150) break
      if (m.portions < 1.5 && kcalOf(m.recipe) * 0.25 <= budget - total() + 100) {
        m.portions += 0.25
        changed = true
      }
    }
  }
}

export async function generateWeek(startDate: string, days = 7) {
  const cat = await loadCatalogue()
  for (let i = 0; i < days; i++) await suggestDay(shiftDate(startDate, i), cat)
}

/** Swap one planned meal for a different recipe in the same slot; others untouched. */
export async function regenerateMeal(meal: PlannedMeal) {
  const cat = await loadCatalogue()
  const type = await dayType(meal.date)
  const r = chooseRecipe(cat, meal.slot as MealSlot, {
    recent: [meal.recipe_id ?? ''],
    cycling: type === 'cycling' || type === 'social_cycling',
    seed: `${meal.date}:${meal.slot}:${nowIso()}`,
    exclude: meal.recipe_id ?? undefined,
  })
  return updatePlannedMeal(meal.id, { recipe_id: r.id })
}

export async function copyMeals(fromDate: string, toDate: string) {
  for (const m of await plannedMeals(fromDate)) {
    await create('planned_meals', { date: toDate, slot: m.slot, recipe_id: m.recipe_id, custom_name: m.custom_name, portions: m.portions, position: m.position })
  }
}

// ── Food log (what was actually eaten) ─────────────────────────────
export async function foodLog(date: string): Promise<FoodLogEntry[]> {
  return (await forDate('food_log_entries', date)).sort((a, b) => a.logged_at.localeCompare(b.logged_at))
}

export async function logRecipe(date: string, slot: MealSlot | 'ride', recipe: Recipe, portions: number, cat: Catalogue, plannedMealId: string | null = null) {
  const m = scaleMacros(recipeMacros(cat, recipe), portions)
  return create('food_log_entries', {
    date,
    slot,
    recipe_id: recipe.id,
    planned_meal_id: plannedMealId,
    name: recipe.name,
    portions,
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein * 10) / 10,
    carbs: Math.round(m.carbs * 10) / 10,
    fat: Math.round(m.fat * 10) / 10,
    fibre: Math.round(m.fibre * 10) / 10,
    during_ride: slot === 'ride',
    logged_at: nowIso(),
  })
}

export async function logPlannedMeal(meal: PlannedMeal, cat?: Catalogue) {
  cat ??= await loadCatalogue()
  const recipe = cat.recipes.find((r) => r.id === meal.recipe_id)
  if (!recipe) throw new Error('Recipe not found')
  return logRecipe(meal.date, meal.slot, recipe, meal.portions, cat, meal.id)
}

export const logCustomFood = (
  date: string,
  slot: MealSlot | 'ride',
  food: { name: string; kcal: number; protein: number; carbs: number; fat: number; fibre?: number; portions?: number },
) =>
  create('food_log_entries', {
    date,
    slot,
    recipe_id: null,
    planned_meal_id: null,
    name: food.name,
    portions: food.portions ?? 1,
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fibre: food.fibre ?? 0,
    during_ride: slot === 'ride',
    logged_at: nowIso(),
  })

export const editFoodLog = (id: string, patch: Partial<FoodLogEntry>) => update('food_log_entries', id, patch)
export const deleteFoodLog = (id: string) => remove('food_log_entries', id)

export function totals(entries: FoodLogEntry[]): Macros {
  return entries.reduce((t, e) => addMacros(t, { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fibre: e.fibre }), zeroMacros())
}

// ── Alcohol ────────────────────────────────────────────────────────
export const alcoholFor = (date: string) => forDate('alcohol_entries', date)
export const alcoholRange = (start: string, end: string) => forDateRange('alcohol_entries', start, end)

export const logDrink = (date: string, d: Omit<AlcoholEntry, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'date' | 'logged_at'>) =>
  create('alcohol_entries', { ...d, date, logged_at: nowIso() })
export const deleteDrink = (id: string) => remove('alcohol_entries', id)

export function alcoholTotals(entries: AlcoholEntry[]) {
  return entries.reduce(
    (t, e) => {
      const d = drinkTotals(e)
      return { units: t.units + d.units, alcohol_kcal: t.alcohol_kcal + d.alcohol_kcal, mixer_kcal: t.mixer_kcal + d.mixer_kcal, total_kcal: t.total_kcal + d.total_kcal }
    },
    { units: 0, alcohol_kcal: 0, mixer_kcal: 0, total_kcal: 0 },
  )
}

// ── Shopping list ──────────────────────────────────────────────────
export const SHOPPING_CATEGORIES: IngredientCategory[] = [
  'Meat and fish',
  'Vegetables',
  'Fruit',
  'Dairy and eggs',
  'Rice, pasta and grains',
  'Tinned and packaged food',
  'Herbs, spices and sauces',
  'Other',
]

export function quantityText(ing: Ingredient, grams: number) {
  if (ing.key === 'eggs') return `${Math.ceil(grams / 60)} eggs (~${Math.round(grams)}g)`
  if (grams >= 1000) return `${(Math.ceil(grams / 50) * 50 / 1000).toFixed(2).replace(/0$/, '')}kg`
  return `${Math.ceil(grams / 5) * 5}g`
}

/** Aggregate ingredients for all planned meals between two dates (inclusive). */
export async function aggregateIngredients(start: string, end: string) {
  const cat = await loadCatalogue()
  const meals = await forDateRange('planned_meals', start, end)
  const grams = new Map<string, number>()
  for (const m of meals) {
    const recipe = cat.recipes.find((r) => r.id === m.recipe_id)
    if (!recipe) continue
    for (const ri of cat.byRecipe.get(recipe.id) ?? []) {
      grams.set(ri.ingredient_id, (grams.get(ri.ingredient_id) ?? 0) + (ri.grams / recipe.portions) * m.portions)
    }
  }
  return [...grams.entries()]
    .map(([id, g]) => ({ ingredient: cat.ingredients.get(id)!, grams: g }))
    .filter((x) => x.ingredient)
    .sort((a, b) => SHOPPING_CATEGORIES.indexOf(a.ingredient.category) - SHOPPING_CATEGORIES.indexOf(b.ingredient.category) || a.ingredient.name.localeCompare(b.ingredient.name))
}

export async function generateShoppingList(start: string, end: string, name?: string) {
  const items = await aggregateIngredients(start, end)
  const listRow = await create('shopping_lists', { name: name ?? `Shopping ${start} to ${end}`, start_date: start, end_date: end, generated_at: nowIso() })
  for (const { ingredient, grams } of items) {
    await create('shopping_list_items', {
      list_id: listRow.id,
      name: ingredient.name,
      category: ingredient.category,
      quantity_g: Math.round(grams),
      quantity_text: quantityText(ingredient, grams),
      checked: false,
      manual: false,
      ingredient_id: ingredient.id,
    })
  }
  return listRow
}
