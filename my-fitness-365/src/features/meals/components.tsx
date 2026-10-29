import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Heart, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Badge, Button, Field, Input, Progress, Segmented, Select, Sheet } from '@/components/ui'
import {
  SLOT_LABEL,
  alcoholFor,
  alcoholTotals,
  dayTargets,
  deleteFoodLog,
  foodLog,
  loadCatalogue,
  logCustomFood,
  logPlannedMeal,
  logRecipe,
  plannedMeals,
  planMeal,
  recipeMacros,
  regenerateMeal,
  removePlannedMeal,
  totals,
  updatePlannedMeal,
  type Catalogue,
} from '@/services/meals'
import { DAY_TYPE_LABEL } from '@/lib/nutrition'
import type { FoodLogEntry, MealSlot, PlannedMeal, Recipe } from '@/data/types'

export const useCatalogue = () => useLiveQuery(() => loadCatalogue(), [])

const k = (n: number) => Math.round(n).toLocaleString('en-GB')

export function NutritionSummary({ date }: { date: string }) {
  const data = useLiveQuery(async () => {
    const [t, log, drinks] = await Promise.all([dayTargets(date), foodLog(date), alcoholFor(date)])
    return { t, eaten: totals(log), alcohol: alcoholTotals(drinks) }
  }, [date])
  if (!data) return null
  const { t, eaten, alcohol } = data
  const remaining = t.kcal - eaten.kcal
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">{t.rideCredits.length ? `${DAY_TYPE_LABEL[t.base.type]} + rides` : DAY_TYPE_LABEL[t.type]}</p>
          <p className="tnum text-3xl font-bold">
            {k(eaten.kcal)} <span className="text-base font-semibold text-muted">/ {k(t.kcal)} kcal food</span>
          </p>
        </div>
        <p className={`tnum text-right text-sm font-semibold ${remaining < 0 ? 'text-warn' : 'text-accent'}`}>
          {remaining >= 0 ? `${k(remaining)} left` : `${k(-remaining)} over`}
        </p>
      </div>
      <Progress value={eaten.kcal} max={t.kcal} label="Food calories" tone={remaining < 0 ? 'warn' : 'accent'} />
      {t.rideCredits.length > 0 && (
        <p className="tnum text-sm text-muted">
          {DAY_TYPE_LABEL[t.base.type]} base {k(t.base.kcal)}
          {t.rideCredits.map((c) => ` + ${k(c.kcal)} ${c.source === 'strava' ? 'Strava' : 'ride estimate'} (${c.name})`).join('')} = <span className="font-semibold text-ink">{k(t.kcal)} kcal</span>
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <MacroBar label="Protein" value={eaten.protein} target={t.protein} />
        <MacroBar label="Carbs" value={eaten.carbs} target={t.carbs} />
        <MacroBar label="Fat" value={eaten.fat} target={t.fat} />
      </div>
      {alcohol.units > 0 && (
        <p className="text-sm text-muted">
          Alcohol (separate from food): <span className="tnum font-semibold text-ink">{k(alcohol.total_kcal)} kcal</span> · {alcohol.units.toFixed(1)} units · Total energy{' '}
          <span className="tnum font-semibold text-ink">{k(eaten.kcal + alcohol.total_kcal)} kcal</span>
        </p>
      )}
    </div>
  )
}

function MacroBar({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <div className="space-y-1">
      <p className="text-muted">{label}</p>
      <p className="tnum font-semibold">
        {Math.round(value)}
        <span className="text-faint">/{target}g</span>
      </p>
      <Progress value={value} max={target} label={`${label} grams`} tone="data" />
    </div>
  )
}

export function MealRow({ meal, cat, logged }: { meal: PlannedMeal; cat: Catalogue; logged: boolean }) {
  const recipe = cat.recipes.find((r) => r.id === meal.recipe_id)
  const [pick, setPick] = useState(false)
  if (!recipe) return null
  const m = recipeMacros(cat, recipe)
  return (
    <div className="border-t border-line/60 py-2 first-of-type:border-0">
      <Link to={`/meals/recipe/${recipe.id}`} className="block">
        <p className="font-semibold leading-tight">{recipe.name}</p>
        <p className="tnum text-sm text-muted">
          {k(m.kcal * meal.portions)} kcal · {Math.round(m.protein * meal.portions)}g protein{meal.portions !== 1 && ` · ×${meal.portions}`}
        </p>
      </Link>
      <div className="mt-1.5 flex items-center gap-1">
        {logged ? (
          <Badge tone="accent">
            <Check className="h-3 w-3" aria-hidden /> Eaten
          </Badge>
        ) : (
          <Button size="sm" variant="primary" onClick={() => logPlannedMeal(meal, cat)} aria-label={`Log ${recipe.name} as eaten`}>
            <Check className="h-4 w-4" aria-hidden /> Log eaten
          </Button>
        )}
        <Button size="sm" variant="ghost" aria-label={`Swap ${recipe.name}`} onClick={() => regenerateMeal(meal)}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Swap
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPick(true)} aria-label={`Change ${recipe.name}`}>
          Change
        </Button>
      </div>
      <RecipePicker
        open={pick}
        onClose={() => setPick(false)}
        cat={cat}
        slot={meal.slot}
        portions={meal.portions}
        onPick={async (r, portions) => {
          await updatePlannedMeal(meal.id, { recipe_id: r.id, portions })
          setPick(false)
        }}
        onRemove={async () => {
          await removePlannedMeal(meal.id)
          setPick(false)
        }}
      />
    </div>
  )
}

export function RecipePicker({ open, onClose, cat, slot, onPick, onRemove, portions: initialPortions = 1, title }: { open: boolean; onClose: () => void; cat: Catalogue; slot: MealSlot; onPick: (r: Recipe, portions: number) => void; onRemove?: () => void; portions?: number; title?: string }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<MealSlot | 'all'>(slot)
  const [portions, setPortions] = useState(initialPortions)
  const results = useMemo(
    () => cat.recipes.filter((r) => (filter === 'all' || r.meal_type === filter) && r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.favourite) - Number(a.favourite)),
    [cat, q, filter],
  )
  return (
    <Sheet open={open} onClose={onClose} title={title ?? `Choose ${SLOT_LABEL[slot].toLowerCase()}`}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input aria-label="Search recipes" placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Segmented label="Meal type" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'breakfast', label: 'Bkfst' }, { value: 'lunch', label: 'Lunch' }, { value: 'dinner', label: 'Dinner' }, { value: 'snack', label: 'Snack' }]} />
        <Field label="Portions" htmlFor="pick-portions">
          <Select id="pick-portions" value={portions} onChange={(e) => setPortions(Number(e.target.value))}>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((p) => (
              <option key={p} value={p}>
                {p} × serving
              </option>
            ))}
          </Select>
        </Field>
        <ul className="divide-y divide-line">
          {results.map((r) => {
            const m = recipeMacros(cat, r)
            return (
              <li key={r.id}>
                <button type="button" className="flex min-h-14 w-full items-center gap-2 py-2 text-left" onClick={() => onPick(r, portions)}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">
                      {r.favourite && <Heart className="mr-1 inline h-3.5 w-3.5 fill-warn text-warn" aria-label="Favourite" />}
                      {r.name}
                    </span>
                    <span className="tnum text-sm text-muted">
                      {k(m.kcal * portions)} kcal · P {Math.round(m.protein * portions)}g · C {Math.round(m.carbs * portions)}g · F {Math.round(m.fat * portions)}g
                    </span>
                  </span>
                  <Plus className="h-5 w-5 text-accent" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
        {onRemove && (
          <Button variant="danger" className="w-full" onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden /> Remove from plan
          </Button>
        )}
      </div>
    </Sheet>
  )
}

export function MealPlanDay({ date }: { date: string }) {
  const cat = useCatalogue()
  const data = useLiveQuery(async () => ({ planned: await plannedMeals(date), log: await foodLog(date) }), [date])
  const [adding, setAdding] = useState<MealSlot | null>(null)
  if (!cat || !data) return null
  const loggedIds = new Set(data.log.map((l) => l.planned_meal_id))
  return (
    <div className="space-y-3">
      {(['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]).map((slot) => {
        const meals = data.planned.filter((m) => m.slot === slot)
        return (
          <div key={slot} role="group" aria-label={SLOT_LABEL[slot]} className="rounded-2xl bg-surface-2/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-faint">{SLOT_LABEL[slot]}</h3>
              <Button size="sm" variant="ghost" onClick={() => setAdding(slot)} aria-label={`Add ${SLOT_LABEL[slot].toLowerCase()}`}>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </Button>
            </div>
            {meals.length === 0 ? <p className="pb-2 text-sm text-faint">Nothing planned.</p> : meals.map((m) => <MealRow key={m.id} meal={m} cat={cat} logged={loggedIds.has(m.id)} />)}
          </div>
        )
      })}
      {adding && (
        <RecipePicker
          open
          onClose={() => setAdding(null)}
          cat={cat}
          slot={adding}
          onPick={async (r, portions) => {
            await planMeal(date, adding, r.id, portions, data.planned.filter((m) => m.slot === adding).length)
            setAdding(null)
          }}
        />
      )}
    </div>
  )
}

export function FoodLogList({ date }: { date: string }) {
  const log = useLiveQuery(() => foodLog(date), [date])
  if (!log) return null
  if (!log.length) return <p className="text-sm text-faint">Nothing logged yet. Planned meals only count once you log them.</p>
  const bySlot = new Map<string, FoodLogEntry[]>()
  for (const e of log) bySlot.set(e.slot, [...(bySlot.get(e.slot) ?? []), e])
  return (
    <div className="space-y-2">
      {[...bySlot.entries()].map(([slot, entries]) => (
        <div key={slot}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{SLOT_LABEL[slot as MealSlot]}</h3>
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{e.name}{e.portions !== 1 && ` ×${e.portions}`}</p>
                  <p className="tnum text-sm text-muted">
                    {k(e.kcal)} kcal · P {Math.round(e.protein)}g · C {Math.round(e.carbs)}g · F {Math.round(e.fat)}g
                  </p>
                </div>
                <Button size="icon" variant="ghost" aria-label={`Delete ${e.name}`} onClick={() => deleteFoodLog(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function AddFoodSheet({ open, onClose, date, defaultSlot = 'snack' }: { open: boolean; onClose: () => void; date: string; defaultSlot?: MealSlot | 'ride' }) {
  const cat = useCatalogue()
  const [mode, setMode] = useState<'recipe' | 'custom'>('recipe')
  const [slot, setSlot] = useState<MealSlot | 'ride'>(defaultSlot)
  const [form, setForm] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
  if (!cat) return null
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })
  const p = Number(form.protein) || 0
  const c = Number(form.carbs) || 0
  const f = Number(form.fat) || 0
  const fromMacros = p * 4 + c * 4 + f * 9
  return (
    <Sheet open={open} onClose={onClose} title="Log food">
      <div className="space-y-3">
        <Field label="Meal" htmlFor="log-slot">
          <Select id="log-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot | 'ride')}>
            {(['breakfast', 'lunch', 'dinner', 'snack', 'ride'] as const).map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Segmented label="Food source" value={mode} onChange={setMode} options={[{ value: 'recipe', label: 'From recipes' }, { value: 'custom', label: 'Custom food' }]} />
        {mode === 'recipe' ? (
          <RecipeQuickList cat={cat} onPick={async (r, portions) => {
            await logRecipe(date, slot, r, portions, cat)
            onClose()
          }} />
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              await logCustomFood(date, slot, { name: form.name, kcal: Number(form.kcal) || Math.round(fromMacros), protein: p, carbs: c, fat: f })
              onClose()
            }}
          >
            <Field label="Food name" htmlFor="cf-name">
              <Input id="cf-name" required value={form.name} onChange={set('name')} placeholder="e.g. Energy bar" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Protein (g)" htmlFor="cf-p"><Input id="cf-p" type="number" inputMode="decimal" value={form.protein} onChange={set('protein')} /></Field>
              <Field label="Carbs (g)" htmlFor="cf-c"><Input id="cf-c" type="number" inputMode="decimal" value={form.carbs} onChange={set('carbs')} /></Field>
              <Field label="Fat (g)" htmlFor="cf-f"><Input id="cf-f" type="number" inputMode="decimal" value={form.fat} onChange={set('fat')} /></Field>
              <Field label="Energy (kcal)" htmlFor="cf-k" hint={fromMacros ? `From macros: ${p}×4 + ${c}×4 + ${f}×9 = ${Math.round(fromMacros)} kcal` : 'Leave blank to calculate from macros'}>
                <Input id="cf-k" type="number" inputMode="numeric" value={form.kcal} onChange={set('kcal')} />
              </Field>
            </div>
            <Button type="submit" variant="primary" className="w-full">Log food</Button>
          </form>
        )}
      </div>
    </Sheet>
  )
}

function RecipeQuickList({ cat, onPick }: { cat: Catalogue; onPick: (r: Recipe, portions: number) => void }) {
  const [q, setQ] = useState('')
  const [portions, setPortions] = useState(1)
  const results = cat.recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input aria-label="Search recipes" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Portions" value={portions} onChange={(e) => setPortions(Number(e.target.value))} className="w-28">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((p) => <option key={p} value={p}>×{p}</option>)}
        </Select>
      </div>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto">
        {results.map((r) => (
          <li key={r.id}>
            <button type="button" className="flex min-h-12 w-full items-center justify-between gap-2 py-2 text-left" onClick={() => onPick(r, portions)}>
              <span className="font-semibold leading-tight">{r.name}</span>
              <span className="tnum shrink-0 text-sm text-muted">{k(recipeMacros(cat, r).kcal * portions)} kcal</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
