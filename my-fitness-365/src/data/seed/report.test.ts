import { it } from 'vitest'
import { openDatabase } from '@/data/db'
import { setSession } from '@/data/repo'
import { seedUser } from '@/data/seed'
import { loadCatalogue, recipeMacros } from '@/services/meals'

// Diagnostic only: REPORT=1 npx vitest run src/data/seed/report.test.ts
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

it.skipIf(!env.REPORT)('prints per-serving macros for every recipe', async () => {
  openDatabase('report')
  setSession('r', false)
  await seedUser('r')
  const cat = await loadCatalogue()
  for (const r of cat.recipes.sort((a, b) => a.meal_type.localeCompare(b.meal_type))) {
    const m = recipeMacros(cat, r)
    console.log([r.meal_type.padEnd(10), String(Math.round(m.kcal)).padStart(4), 'P', m.protein.toFixed(0).padStart(3), 'C', m.carbs.toFixed(0).padStart(3), 'F', m.fat.toFixed(0).padStart(3), r.name].join(' '))
  }
})

it.skipIf(!env.REPORT)('prints suggested-day totals vs targets for a week', async () => {
  const { suggestDay, plannedMeals, dayTargets } = await import('@/services/meals')
  openDatabase('report2')
  setSession('r2', false)
  await seedUser('r2')
  const cat = await loadCatalogue()
  for (const d of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']) {
    await suggestDay(d, cat)
    const meals = await plannedMeals(d)
    const kcal = meals.reduce((t, m) => t + recipeMacros(cat, cat.recipes.find((r) => r.id === m.recipe_id)!).kcal * m.portions, 0)
    const p = meals.reduce((t, m) => t + recipeMacros(cat, cat.recipes.find((r) => r.id === m.recipe_id)!).protein * m.portions, 0)
    const t = await dayTargets(d)
    console.log(d, t.type.padEnd(15), 'target', t.kcal, 'suggested', Math.round(kcal), 'protein', Math.round(p))
  }
})
