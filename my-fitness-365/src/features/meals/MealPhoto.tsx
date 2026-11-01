import { useRef, useState } from 'react'
import { Camera, ImageUp, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Badge, Button, Field, Input } from '@/components/ui'
import { estimateMeal, estimateTotals, hasConsent, logEstimate, mealPhotoAvailable, prepareMealImage, scaleItem, setConsent, type EstimateItem, type MealEstimate } from '@/services/mealPhoto'
import type { MealSlot } from '@/data/types'

const k = (n: number) => Math.round(n).toLocaleString('en-GB')

/** Photo → editable calorie estimate → log. The photo is sent for the estimate and not kept. */
export function MealPhotoPanel({ date, slot, onLogged }: { date: string; slot: MealSlot | 'ride'; onLogged: () => void }) {
  const consent = useLiveQuery(() => hasConsent(), [])
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<MealEstimate | null>(null)
  const [items, setItems] = useState<EstimateItem[]>([])
  const [originals, setOriginals] = useState<EstimateItem[]>([])
  const [name, setName] = useState('')

  if (!mealPhotoAvailable) {
    return (
      <div className="space-y-2 rounded-2xl bg-surface-2/60 p-3 text-sm text-muted">
        <p className="flex items-center gap-2"><Badge tone="warn">Not set up yet</Badge></p>
        <p>Once the app is deployed with an Anthropic API key, you can take a photo of a meal here and get an estimate of what’s on the plate, the portion sizes and the calories, which you can adjust before logging.</p>
      </div>
    )
  }
  if (consent === undefined) return null
  if (!consent) {
    return (
      <div className="space-y-3 rounded-2xl bg-surface-2/60 p-3 text-sm text-muted">
        <p className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck className="h-5 w-5 text-accent" aria-hidden /> Turn on photo estimates?</p>
        <p>Meal photos you choose are sent to Anthropic’s Claude AI to estimate the food and calories. The photo is reduced in size, stripped of location data and not stored by this app. Progress photos are never sent.</p>
        <Button variant="primary" className="w-full" onClick={() => setConsent(true)}>Turn on photo estimates</Button>
      </div>
    )
  }

  const pick = async (file?: File) => {
    setError(null)
    setEstimate(null)
    if (!file) return
    try {
      const { blob } = await prepareMealImage(file)
      if (image) URL.revokeObjectURL(image.url)
      setImage({ blob, url: URL.createObjectURL(blob) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that photo')
    }
  }

  const run = async () => {
    if (!image) return
    setBusy(true)
    setError(null)
    try {
      const est = await estimateMeal(image.blob, description)
      if (!est.is_food || !est.items.length) {
        setError('No food was recognised in that photo. Try a clearer photo, or add a description.')
        return
      }
      setEstimate(est)
      setItems(est.items)
      setOriginals(est.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Estimate failed')
    } finally {
      setBusy(false)
    }
  }

  const total = estimateTotals(items)

  return (
    <div className="space-y-3">
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take meal photo" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={library} type="file" accept="image/*" className="hidden" aria-label="Choose meal photo" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => camera.current?.click()}><Camera className="h-4 w-4" aria-hidden /> Take photo</Button>
        <Button onClick={() => library.current?.click()}><ImageUp className="h-4 w-4" aria-hidden /> Choose photo</Button>
      </div>
      {image && <img src={image.url} alt="Meal to estimate" className="max-h-56 w-full rounded-xl object-cover" />}
      {image && !estimate && (
        <>
          <Field label="What is it? (optional, improves the estimate)" htmlFor="mp-desc">
            <Input id="mp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. chicken curry with rice, large plate" />
          </Field>
          <Button variant="primary" className="w-full" disabled={busy} onClick={run}>
            <Sparkles className="h-4 w-4" aria-hidden /> {busy ? 'Estimating… (about 10–20 seconds)' : 'Estimate calories'}
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {estimate && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Estimate</p>
            <Badge tone={estimate.confidence === 'high' ? 'accent' : estimate.confidence === 'medium' ? 'data' : 'warn'}>{estimate.confidence} confidence</Badge>
          </div>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="rounded-xl bg-surface-2/60 p-2">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 font-semibold leading-tight">{it.name}</p>
                  <button type="button" aria-label={`Remove ${it.name}`} className="p-2 text-faint hover:text-danger" onClick={() => { setItems(items.filter((_, j) => j !== i)); setOriginals(originals.filter((_, j) => j !== i)) }}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <Input aria-label={`Grams of ${it.name}`} type="number" inputMode="numeric" className="w-24" value={it.grams} onChange={(e) => {
                    const g = Math.max(0, Number(e.target.value) || 0)
                    setItems(items.map((x, j) => (j === i ? scaleItem(originals[j], g) : x)))
                  }} />
                  <span className="text-muted">g</span>
                  <span className="tnum ml-auto text-sm text-muted">{k(it.kcal)} kcal · P {Math.round(it.protein)} · C {Math.round(it.carbs)} · F {Math.round(it.fat)}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="tnum rounded-xl bg-accent/10 p-2 font-semibold">
            Total: {k(total.kcal)} kcal · protein {Math.round(total.protein)}g · carbs {Math.round(total.carbs)}g · fat {Math.round(total.fat)}g
          </p>
          {estimate.notes && <p className="text-sm text-muted">{estimate.notes}</p>}
          <p className="text-xs text-faint">Photo estimates can be well out, especially for oil, sauces and hidden portions. Adjust the grams if you know them; calories change in proportion.</p>
          <Field label="Name in your diary (optional)" htmlFor="mp-name">
            <Input id="mp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={items.map((i) => i.name).join(', ')} />
          </Field>
          <Button variant="primary" size="lg" className="w-full" disabled={!items.length} onClick={async () => { await logEstimate(date, slot, items, name); onLogged() }}>
            Log {k(total.kcal)} kcal
          </Button>
        </div>
      )}
    </div>
  )
}
