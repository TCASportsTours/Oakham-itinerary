import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Copy, Heart, ListChecks, Plus, Share2, Sparkles, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Select, Sheet } from '@/components/ui'
import { AddFoodSheet, FoodLogList, MealPlanDay, NutritionSummary, useCatalogue } from './components'
import { DrinksCard } from './Drinks'
import { copyMeals, generateShoppingList, generateWeek, logRecipe, recipeMacros, SHOPPING_CATEGORIES, suggestDay } from '@/services/meals'
import { create, get, list, remove, update, where } from '@/data/repo'
import { formatLong, formatUK, shiftDate, today } from '@/lib/dates'
import type { IngredientCategory, MealSlot, ShoppingListItem } from '@/data/types'

export function Meals() {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? today()
  const tab = (params.get('tab') as 'plan' | 'recipes' | 'shopping') ?? 'plan'
  const set = (patch: Record<string, string>) => setParams({ date, tab, ...patch }, { replace: true })
  return (
    <div>
      <PageHeader title="Meals" />
      <div className="mb-4">
        <Segmented label="Section" value={tab} onChange={(t) => set({ tab: t })} options={[{ value: 'plan', label: 'Planner' }, { value: 'recipes', label: 'Recipes' }, { value: 'shopping', label: 'Shopping' }]} />
      </div>
      {tab === 'plan' && <Planner date={date} setDate={(d) => set({ date: d })} />}
      {tab === 'recipes' && <Recipes />}
      {tab === 'shopping' && <Shopping start={date} />}
    </div>
  )
}

function Planner({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const [food, setFood] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="flex-1 text-center">
          <p className="font-semibold">{formatLong(date)}</p>
          {date !== today() && <button type="button" className="text-sm text-accent" onClick={() => setDate(today())}>Back to today</button>}
        </div>
        <Button size="icon" aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight className="h-5 w-5" /></Button>
      </div>
      <Card><NutritionSummary date={date} /></Card>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => run('day', () => suggestDay(date))} disabled={!!busy}><Sparkles className="h-4 w-4" aria-hidden /> Suggest day</Button>
        <Button onClick={() => run('copy', () => copyMeals(shiftDate(date, -1), date))} disabled={!!busy}><Copy className="h-4 w-4" aria-hidden /> Copy yesterday</Button>
        <Button className="col-span-2" variant="primary" onClick={() => run('week', () => generateWeek(date))} disabled={!!busy}>
          <Sparkles className="h-4 w-4" aria-hidden /> {busy === 'week' ? 'Planning…' : 'Fill the next 7 days'}
        </Button>
      </div>
      <p className="text-xs text-faint">Suggestions only fill empty slots — nothing you’ve chosen is replaced. Use the ↻ button to swap a single meal.</p>
      <Card>
        <SectionTitle>Planned</SectionTitle>
        <MealPlanDay date={date} />
      </Card>
      <Card>
        <SectionTitle action={<Button size="sm" variant="primary" onClick={() => setFood(true)}><Plus className="h-4 w-4" aria-hidden /> Log food</Button>}>Actually eaten</SectionTitle>
        <FoodLogList date={date} />
      </Card>
      <DrinksCard date={date} />
      {food && <AddFoodSheet open onClose={() => setFood(false)} date={date} />}
    </div>
  )
}

function Recipes() {
  const cat = useCatalogue()
  const [filter, setFilter] = useState<MealSlot | 'fav'>('dinner')
  if (!cat) return null
  const shown = cat.recipes.filter((r) => (filter === 'fav' ? r.favourite : r.meal_type === filter))
  return (
    <div className="space-y-3">
      <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: 'breakfast', label: 'Bkfst' }, { value: 'lunch', label: 'Lunch' }, { value: 'dinner', label: 'Dinner' }, { value: 'snack', label: 'Snack' }, { value: 'fav', label: '♥' }]} />
      {shown.length === 0 && <p className="text-muted">No favourites yet — tap the heart on a recipe.</p>}
      <ul className="space-y-2">
        {shown.map((r) => {
          const m = recipeMacros(cat, r)
          return (
            <li key={r.id}>
              <Link to={`/meals/recipe/${r.id}`} className="block rounded-2xl bg-surface p-3 hover:bg-surface-2">
                <p className="font-semibold leading-tight">{r.favourite && <Heart className="mr-1 inline h-3.5 w-3.5 fill-warn text-warn" aria-label="Favourite" />}{r.name}</p>
                <p className="tnum text-sm text-muted">{Math.round(m.kcal)} kcal · P {Math.round(m.protein)}g · C {Math.round(m.carbs)}g · F {Math.round(m.fat)}g · {r.prep_min + r.cook_min} min</p>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-faint">Nutrition values are estimates calculated from typical UK label values per ingredient — not laboratory data.</p>
    </div>
  )
}

export function RecipeDetail() {
  const { id = '' } = useParams()
  const cat = useCatalogue()
  const [portions, setPortions] = useState(1)
  const [planOpen, setPlanOpen] = useState(false)
  const [planDate, setPlanDate] = useState(today())
  const [done, setDone] = useState<string | null>(null)
  const recipe = cat?.recipes.find((r) => r.id === id)
  if (!cat || !recipe) return null
  const m = recipeMacros(cat, recipe)
  const ris = cat.byRecipe.get(recipe.id) ?? []
  return (
    <div className="space-y-4">
      <PageHeader
        title={recipe.name}
        subtitle={`Prep ${recipe.prep_min} min · Cook ${recipe.cook_min} min · Makes ${recipe.portions} portion${recipe.portions > 1 ? 's' : ''}`}
        back="/meals?tab=recipes"
        action={
          <Button size="icon" aria-label={recipe.favourite ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={recipe.favourite} onClick={() => update('recipes', recipe.id, { favourite: !recipe.favourite })}>
            <Heart className={recipe.favourite ? 'h-5 w-5 fill-warn text-warn' : 'h-5 w-5'} />
          </Button>
        }
      />
      <div className="flex flex-wrap gap-1.5">{recipe.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
      <Card>
        <Field label="Servings" htmlFor="servings">
          <Select id="servings" value={portions} onChange={(e) => setPortions(Number(e.target.value))}>
            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((p) => <option key={p} value={p}>{p} serving{p === 1 ? '' : 's'}</option>)}
          </Select>
        </Field>
        <div className="tnum mt-3 grid grid-cols-5 gap-2 text-center">
          {[['kcal', m.kcal, ''], ['Protein', m.protein, 'g'], ['Carbs', m.carbs, 'g'], ['Fat', m.fat, 'g'], ['Fibre', m.fibre, 'g']].map(([l, v, u]) => (
            <div key={l as string}><p className="text-lg font-bold">{Math.round((v as number) * portions)}{u}</p><p className="text-xs text-faint">{l}</p></div>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">Estimated per {portions} serving(s) from ingredient weights × typical per-100g values.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={async () => { await logRecipe(today(), recipe.meal_type, recipe, portions, cat); setDone('Logged as eaten today') }}>Log as eaten</Button>
          <Button onClick={() => setPlanOpen(true)}>Add to plan</Button>
        </div>
        {done && <p role="status" className="mt-2 text-sm text-accent">{done}</p>}
      </Card>
      <Card>
        <SectionTitle>Ingredients ({recipe.portions} portion{recipe.portions > 1 ? 's' : ''})</SectionTitle>
        <ul className="divide-y divide-line">
          {ris.map((ri) => {
            const ing = cat.ingredients.get(ri.ingredient_id)
            return (
              <li key={ri.id} className="flex justify-between gap-3 py-2">
                <span>{ing?.name}{ri.note && <span className="block text-sm text-faint">{ri.note}</span>}</span>
                <span className="tnum shrink-0 text-muted">{ri.grams}g <span className="text-xs text-faint">{ing?.state}</span></span>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-faint">Weights are raw/dry unless marked otherwise (e.g. rice and pasta are dry weight; meat is raw).</p>
      </Card>
      <Card>
        <SectionTitle>Method</SectionTitle>
        <ol className="list-decimal space-y-2 pl-5">{recipe.instructions.map((s) => <li key={s}>{s}</li>)}</ol>
      </Card>
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Add to meal plan">
        <div className="space-y-3">
          <Field label="Date" htmlFor="plan-date"><Input id="plan-date" type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} /></Field>
          <Button variant="primary" className="w-full" onClick={async () => {
            await create('planned_meals', { date: planDate, slot: recipe.meal_type, recipe_id: recipe.id, custom_name: null, portions, position: 9 })
            setPlanOpen(false)
            setDone(`Added to ${formatUK(planDate)}`)
          }}>Add {recipe.meal_type}</Button>
        </div>
      </Sheet>
    </div>
  )
}

function Shopping({ start }: { start: string }) {
  const lists = useLiveQuery(async () => (await list('shopping_lists')).sort((a, b) => b.generated_at.localeCompare(a.generated_at)), [])
  const [from, setFrom] = useState(start)
  const [to, setTo] = useState(shiftDate(start, 6))
  const [selected, setSelected] = useState<string | null>(null)
  const active = selected ?? lists?.[0]?.id ?? null
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <SectionTitle>New list from planned meals</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="sl-from"><Input id="sl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="sl-to"><Input id="sl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Button variant="primary" className="w-full" onClick={async () => setSelected((await generateShoppingList(from, to, `${formatUK(from)} – ${formatUK(to)}`)).id)}>
          <ListChecks className="h-4 w-4" aria-hidden /> Generate shopping list
        </Button>
      </Card>
      {lists && lists.length > 1 && (
        <Field label="Saved lists" htmlFor="sl-pick">
          <Select id="sl-pick" value={active ?? ''} onChange={(e) => setSelected(e.target.value)}>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
      )}
      {active ? <ShoppingListView id={active} /> : <p className="text-muted">Plan some meals, then generate a list.</p>}
    </div>
  )
}

function ShoppingListView({ id }: { id: string }) {
  const data = useLiveQuery(async () => ({ list: await get('shopping_lists', id), items: await where('shopping_list_items', 'list_id', id) }), [id])
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [category, setCategory] = useState<IngredientCategory>('Other')
  const [copied, setCopied] = useState(false)
  if (!data?.list) return null
  const items = data.items
  const asText = () =>
    SHOPPING_CATEGORIES.map((c) => {
      const rows = items.filter((i) => i.category === c && !i.checked)
      return rows.length ? `${c}\n${rows.map((i) => `- ${i.name} (${i.quantity_text})`).join('\n')}` : ''
    }).filter(Boolean).join('\n\n')
  const share = async () => {
    const text = `${data.list!.name}\n\n${asText()}`
    if (navigator.share) await navigator.share({ title: 'Shopping list', text }).catch(() => undefined)
    else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    }
  }
  return (
    <Card>
      <SectionTitle action={<div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={async () => { await navigator.clipboard.writeText(asText()); setCopied(true) }}><Copy className="h-4 w-4" aria-hidden /> {copied ? 'Copied' : 'Copy'}</Button>
        <Button size="sm" variant="ghost" onClick={share}><Share2 className="h-4 w-4" aria-hidden /> Share</Button>
      </div>}>{data.list.name}</SectionTitle>
      {items.length === 0 && <p className="text-sm text-muted">No items — were meals planned in that date range?</p>}
      {SHOPPING_CATEGORIES.map((c) => {
        const rows = items.filter((i) => i.category === c).sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name))
        if (!rows.length) return null
        return (
          <div key={c} className="mt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{c}</h3>
            <ul>
              {rows.map((i) => (
                <ShoppingRow key={i.id} item={i} />
              ))}
            </ul>
          </div>
        )
      })}
      <form className="mt-4 space-y-2 border-t border-line pt-3" onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        await create('shopping_list_items', { list_id: id, name: name.trim(), category, quantity_g: null, quantity_text: qty || '1', checked: false, manual: true, ingredient_id: null })
        setName('')
        setQty('')
      }}>
        <p className="text-sm font-semibold">Add item</p>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Input aria-label="Item name" placeholder="e.g. Kitchen roll" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="Quantity" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as IngredientCategory)}>
            {SHOPPING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Button type="submit"><Plus className="h-4 w-4" aria-hidden /> Add</Button>
        </div>
      </form>
    </Card>
  )
}


/** Checkbox state is optimistic so the tick responds instantly while the write lands. */
function ShoppingRow({ item: i }: { item: ShoppingListItem }) {
  const [checked, setChecked] = useState(i.checked)
  useEffect(() => setChecked(i.checked), [i.checked])
  return (
    <li className="flex min-h-12 items-center gap-3">
      <input type="checkbox" aria-label={`Got ${i.name}`} checked={checked} onChange={() => { setChecked(!checked); update('shopping_list_items', i.id, { checked: !checked }) }} className="h-6 w-6 shrink-0 accent-[#51cea7]" />
      <span className={`flex-1 ${checked ? 'text-faint line-through' : ''}`}>{i.name}</span>
      <input aria-label={`Quantity of ${i.name}`} defaultValue={i.quantity_text} onBlur={(e) => e.target.value !== i.quantity_text && update('shopping_list_items', i.id, { quantity_text: e.target.value })} className="tnum min-h-9 w-24 rounded-lg border border-line bg-bg px-2 text-right text-sm text-muted" />
      <button type="button" aria-label={`Remove ${i.name}`} className="p-2 text-faint hover:text-danger" onClick={() => remove('shopping_list_items', i.id)}><Trash2 className="h-4 w-4" /></button>
    </li>
  )
}
