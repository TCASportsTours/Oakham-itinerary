import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, db } from '@/data/db'
import { setSession } from '@/data/repo'
import { seedUser } from '@/data/seed'
import * as diary from './diary'
import * as workouts from './workouts'
import * as meals from './meals'
import * as body from './body'
import { list } from '@/data/repo'

let n = 0
beforeEach(async () => {
  openDatabase(`test-${++n}-${Math.random()}`)
  setSession('user-a', false)
  await seedUser('user-a')
})

const MONDAY = '2026-11-02'
const WEDNESDAY = '2026-11-04'

describe('diary', () => {
  it('shows the weekly default without storing it', async () => {
    const plan = await diary.getDayPlan(MONDAY)
    expect(plan.map((p) => p.title)).toEqual(['Workout A — Chest & Shoulders', 'Mountain bike — Easy'])
    expect(plan.every((p) => p.virtual)).toBe(true)
    expect(await db.scheduled_activities.count()).toBe(0)
  })

  it('adds an activity and combines several on one date', async () => {
    const templates = await list('activity_templates')
    await diary.addActivity(MONDAY, templates.find((t) => t.key === 'social')!)
    const plan = await diary.getDayPlan(MONDAY)
    expect(plan.map((p) => p.kind)).toEqual(['workout', 'ride', 'social'])
    expect(plan.every((p) => !p.virtual)).toBe(true)
  })

  it('reschedules a workout and keeps a record on the original day', async () => {
    const [workoutA] = await diary.getDayPlan(MONDAY)
    await diary.rescheduleActivity(workoutA, '2026-11-03')
    const mon = await diary.getDayPlan(MONDAY)
    const tue = await diary.getDayPlan('2026-11-03')
    expect(mon.find((p) => p.kind === 'workout')!.status).toBe('cancelled')
    const moved = tue.find((p) => p.kind === 'workout')!
    expect(moved.status).toBe('planned')
    expect(moved.rescheduled_from).toBe(MONDAY)
  })

  it('saves a note', async () => {
    await diary.updateDiary(MONDAY, { notes: 'Felt strong' })
    expect((await diary.getDiaryEntry(MONDAY))!.notes).toBe('Felt strong')
  })

  it('preserves completed history when the weekly schedule changes', async () => {
    const [a] = await diary.getDayPlan(MONDAY)
    await diary.setActivityStatus(a, 'completed')
    const { updateSettings, getSettings } = await import('./profile')
    const s = (await getSettings())!
    await updateSettings({ weekly_schedule: { ...s.weekly_schedule, '1': ['rest'] } })
    const plan = await diary.getDayPlan(MONDAY)
    expect(plan.find((p) => p.title.startsWith('Workout A'))!.status).toBe('completed')
    // An untouched Monday follows the new default
    expect((await diary.getDayPlan('2026-11-09')).map((p) => p.kind)).toEqual(['rest'])
  })

  it('refuses to move or remove completed activities', async () => {
    const [a] = await diary.getDayPlan(MONDAY)
    await diary.setActivityStatus(a, 'completed')
    const [stored] = await diary.getDayPlan(MONDAY)
    await expect(diary.rescheduleActivity(stored, WEDNESDAY)).rejects.toThrow()
    await expect(diary.removeActivity(stored)).rejects.toThrow()
  })
})

describe('workouts', () => {
  const templateA = async () => (await list('workout_templates')).find((t) => t.key === 'workout_a')!

  it('starts a session with planned sets and links it to the diary', async () => {
    const t = await templateA()
    const s = await workouts.startSession(t.id, MONDAY)
    const sets = await workouts.getSessionSets(s.id)
    expect(sets).toHaveLength(10) // 5 exercises × 2 sets
    const plan = await diary.getDayPlan(MONDAY)
    expect(plan.find((p) => p.kind === 'workout')!.workout_session_id).toBe(s.id)
  })

  it('completes and edits sets, resumes, finishes and shows previous performance', async () => {
    const t = await templateA()
    const s = await workouts.startSession(t.id, MONDAY)
    const [first] = await workouts.getSessionSets(s.id)
    await workouts.updateSet(first.id, { weight_kg: 8, reps: 11 })
    await workouts.toggleSetComplete((await workouts.getSessionSets(s.id))[0])
    await workouts.setCurrentIndex(s.id, 2)

    // "Close the app" — resume finds the same in-progress session
    const resumed = await workouts.getActiveSession()
    expect(resumed!.id).toBe(s.id)
    expect(resumed!.current_index).toBe(2)
    expect(await workouts.startSession(t.id, MONDAY)).toMatchObject({ id: s.id })

    await workouts.finishSession(resumed!)
    expect(await workouts.getActiveSession()).toBeUndefined()
    const plan = await diary.getDayPlan(MONDAY)
    expect(plan.find((p) => p.kind === 'workout')!.status).toBe('completed')

    const prev = await workouts.previousPerformance(first.exercise_id)
    expect(prev!.sets[0]).toMatchObject({ weight_kg: 8, reps: 11, completed: true })

    // Next session pre-fills the last weight used
    const s2 = await workouts.startSession(t.id, '2026-11-09')
    const firstNext = (await workouts.getSessionSets(s2.id)).find((x) => x.exercise_id === first.exercise_id)!
    expect(firstNext.weight_kg).toBe(8)
  })
})

describe('meals', () => {
  it('computes recipe macros that reconcile with energy', async () => {
    const cat = await meals.loadCatalogue()
    expect(cat.recipes.filter((r) => r.meal_type === 'breakfast').length).toBeGreaterThanOrEqual(7)
    expect(cat.recipes.filter((r) => r.meal_type === 'lunch').length).toBeGreaterThanOrEqual(10)
    expect(cat.recipes.filter((r) => r.meal_type === 'dinner').length).toBeGreaterThanOrEqual(14)
    expect(cat.recipes.filter((r) => r.meal_type === 'snack').length).toBeGreaterThanOrEqual(10)
    for (const r of cat.recipes) {
      const m = meals.recipeMacros(cat, r)
      const fromMacros = m.protein * 4 + m.carbs * 4 + m.fat * 9
      // Label kcal include fibre/rounding, so allow 12% tolerance.
      expect(Math.abs(fromMacros - m.kcal) / m.kcal, r.name).toBeLessThan(0.12)
    }
  })

  it('keeps planned and eaten meals separate; logging and portions work', async () => {
    await meals.suggestDay(MONDAY)
    const planned = await meals.plannedMeals(MONDAY)
    expect(planned.some((p) => p.slot === 'dinner')).toBe(true)
    expect(await meals.foodLog(MONDAY)).toHaveLength(0)

    const dinner = planned.find((p) => p.slot === 'dinner')!
    await meals.updatePlannedMeal(dinner.id, { portions: 1.5 })
    const cat = await meals.loadCatalogue()
    const entry = await meals.logPlannedMeal({ ...dinner, portions: 1.5 }, cat)
    const recipe = cat.recipes.find((r) => r.id === dinner.recipe_id)!
    expect(entry.kcal).toBe(Math.round(meals.recipeMacros(cat, recipe).kcal * 1.5))
    expect(meals.totals(await meals.foodLog(MONDAY)).kcal).toBe(entry.kcal)
  })

  it('sizes a suggested day close to its calorie target', async () => {
    const cat = await meals.loadCatalogue()
    for (const d of ['2026-11-02', '2026-11-03', '2026-11-07']) {
      await meals.suggestDay(d, cat)
      const planned = await meals.plannedMeals(d)
      const kcal = planned.reduce((t, m) => t + meals.recipeMacros(cat, cat.recipes.find((r) => r.id === m.recipe_id)!).kcal * m.portions, 0)
      const { kcal: target } = await meals.dayTargets(d)
      expect(kcal, d).toBeGreaterThan(target - 300)
      expect(kcal, d).toBeLessThan(target + 150)
    }
  })

  it('swaps one meal without changing the others', async () => {
    await meals.suggestDay(MONDAY)
    const before = await meals.plannedMeals(MONDAY)
    const dinner = before.find((p) => p.slot === 'dinner')!
    await meals.regenerateMeal(dinner)
    const after = await meals.plannedMeals(MONDAY)
    expect(after.find((p) => p.id === dinner.id)!.recipe_id).not.toBe(dinner.recipe_id)
    for (const m of before.filter((p) => p.id !== dinner.id)) expect(after.find((p) => p.id === m.id)!.recipe_id).toBe(m.recipe_id)
  })

  it('generates a consolidated shopping list', async () => {
    const cat = await meals.loadCatalogue()
    const grilled = cat.recipes.find((r) => r.key === 'd_grilled_chicken_broccoli_potatoes')!
    const garlic = cat.recipes.find((r) => r.key === 'd_garlic_chicken_beans_potatoes')!
    await meals.planMeal(MONDAY, 'dinner', grilled.id)
    await meals.planMeal('2026-11-03', 'dinner', garlic.id)
    await meals.planMeal('2026-11-03', 'lunch', grilled.id, 2)
    const agg = await meals.aggregateIngredients(MONDAY, '2026-11-08')
    const chicken = agg.find((a) => a.ingredient.key === 'chicken_breast')!
    expect(chicken.grams).toBe(200 + 200 + 400)
    const listRow = await meals.generateShoppingList(MONDAY, '2026-11-08')
    const items = (await list('shopping_list_items')).filter((i) => i.list_id === listRow.id)
    expect(items.filter((i) => i.name === chicken.ingredient.name)).toHaveLength(1)
    expect(items.find((i) => i.name === chicken.ingredient.name)!.category).toBe('Meat and fish')
  })

  it('uses the right calorie target for the day type', async () => {
    expect((await meals.dayTargets('2026-11-03')).kcal).toBe(2600) // Tuesday main ride
    expect((await meals.dayTargets('2026-11-05')).type).toBe('social_cycling') // Thursday
    expect((await meals.dayTargets(WEDNESDAY)).type).toBe('gym')
    await diary.updateDiary(WEDNESDAY, { day_type_override: 'rest' })
    expect((await meals.dayTargets(WEDNESDAY)).kcal).toBe(2100)
  })
})

describe('body', () => {
  it('saves partial measurements, converts inches, edits and deletes', async () => {
    const saved = await body.addMeasurements('2026-11-01', { waist_navel: 40, chest: undefined, shoulders: null }, 'in')
    expect(saved).toHaveLength(1)
    expect(saved[0].value).toBeCloseTo(101.6)
    await body.editMeasurement(saved[0].id, { value: 100 })
    expect((await body.measurements())[0].value).toBe(100)
    await body.deleteMeasurement(saved[0].id)
    expect(await body.measurements()).toHaveLength(0)
  })

  it('stores weights in kg and orders them by date', async () => {
    await body.addWeight('2026-11-03', 88.1)
    await body.addWeight('2026-11-01', 88.9)
    const w = await body.weights()
    expect(w.map((x) => x.date)).toEqual(['2026-11-01', '2026-11-03'])
    await body.deleteWeight(w[0].id)
    expect(await body.weights()).toHaveLength(1)
  })
})

describe('data isolation (local)', () => {
  it('never returns another user’s rows', async () => {
    await body.addWeight('2026-11-01', 90)
    setSession('user-b', false)
    await seedUser('user-b')
    expect(await body.weights()).toHaveLength(0)
    setSession('user-a', false)
    expect(await body.weights()).toHaveLength(1)
  })
})
