import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirm } from '@/components/confirm'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Columns2, ImageUp, Lock, Maximize2, RotateCw, ShieldAlert, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, Empty, Field, Input, LinkButton, PageHeader, SectionTitle, Segmented, Select, Textarea } from '@/components/ui'
import { useSession } from '@/app/session'
import { decodeImage, defaultAdjustments, deletePhoto, photoUrl, photos as listPhotos, renderPhoto, savePhoto, PHOTO_VIEWS, type Adjustments } from '@/services/photos'
import { formatUK, today } from '@/lib/dates'
import type { PhotoView, ProgressPhoto } from '@/data/types'

const VIEW_LABEL: Record<PhotoView, string> = { front: 'Front', side: 'Side', back: 'Back' }

export function usePhotoUrl(photo: ProgressPhoto | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    setError(null)
    if (photo) photoUrl(photo).then((u) => live && setUrl(u)).catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load photo'))
    return () => {
      live = false
    }
  }, [photo])
  return { url, error }
}

export function PhotoImg({ photo, className, style }: { photo: ProgressPhoto; className?: string; style?: React.CSSProperties }) {
  const { url, error } = usePhotoUrl(photo)
  if (error) return <div className={`flex items-center justify-center bg-surface-2 p-2 text-center text-xs text-muted ${className}`}>Photo unavailable offline</div>
  if (!url) return <div className={`animate-pulse bg-surface-2 ${className}`} aria-label="Loading photo" />
  return <img src={url} alt={`${VIEW_LABEL[photo.view]} progress photo, ${formatUK(photo.date)}`} className={className} style={style} draggable={false} />
}

function PrivacyNote() {
  const { mode } = useSession()
  return mode === 'cloud' ? (
    <p className="flex items-start gap-2 text-sm text-muted"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> Photos are stored in your private cloud bucket. Only your signed-in account can load them; nothing is shared or sent for AI processing.</p>
  ) : (
    <p className="flex items-start gap-2 rounded-xl bg-warn/10 p-3 text-sm text-warn"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Local-only mode: photos are kept in this browser’s storage on this device only. Clearing Safari website data or deleting the app will erase them — use Settings → Backup regularly.</p>
  )
}

export function PhotosPage() {
  const confirm = useConfirm()
  const all = useLiveQuery(() => listPhotos(), [])
  if (!all) return null
  const byDate = new Map<string, ProgressPhoto[]>()
  for (const p of all) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p])
  return (
    <div className="space-y-4">
      <PageHeader title="Progress photos" back="/progress" />
      <PrivacyNote />
      <div className="grid grid-cols-2 gap-2">
        <LinkButton to="/progress/photos/new" variant="primary"><Camera className="h-4 w-4" aria-hidden /> Take photos</LinkButton>
        <LinkButton to="/progress/photos/compare"><Columns2 className="h-4 w-4" aria-hidden /> Compare</LinkButton>
      </div>
      {all.length === 0 && <Empty icon={<Camera className="h-8 w-8" />} title="No photos yet">Take a front, side and back photo in the same spot, lighting and clothing every four weeks.</Empty>}
      {[...byDate.entries()].map(([date, ps]) => (
        <Card key={date}>
          <SectionTitle>{formatUK(date)}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {PHOTO_VIEWS.map((v) => {
              const p = ps.find((x) => x.view === v)
              return p ? (
                <figure key={v} className="space-y-1">
                  <PhotoImg photo={p} className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <figcaption className="flex items-center justify-between text-xs text-muted">
                    {VIEW_LABEL[v]}
                    {p.storage === 'cloud' && !p.uploaded && <Badge tone="warn">Not uploaded</Badge>}
                    <button type="button" aria-label={`Delete ${VIEW_LABEL[v]} photo from ${formatUK(date)}`} className="p-1 text-faint hover:text-danger" onClick={async () => (await confirm({ title: 'Delete photo?', message: 'This permanently removes the image and its details.', confirmLabel: 'Delete', destructive: true })) && deletePhoto(p)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </figcaption>
                </figure>
              ) : (
                <div key={v} className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-line text-xs text-faint">No {VIEW_LABEL[v].toLowerCase()}</div>
              )
            })}
          </div>
          {ps.some((p) => p.notes) && <p className="mt-2 text-sm text-muted">{ps.map((p) => p.notes).filter(Boolean).join(' · ')}</p>}
        </Card>
      ))}
    </div>
  )
}

export function NewPhoto() {
  const nav = useNavigate()
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<PhotoView>('front')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState<ImageBitmap | HTMLImageElement | null>(null)
  const [adj, setAdj] = useState<Adjustments>(defaultAdjustments)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedViews, setSavedViews] = useState<PhotoView[]>([])

  useEffect(() => {
    if (!source) return
    let url: string | null = null
    let live = true
    renderPhoto(source, adj).then(({ blob }) => {
      if (!live) return
      url = URL.createObjectURL(blob)
      setPreview(url)
    })
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [source, adj])

  const onFile = async (f?: File) => {
    setError(null)
    if (!f) return
    try {
      setSource(await decodeImage(f))
      setAdj(defaultAdjustments)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image')
    }
  }

  const save = async () => {
    if (!source) return
    setSaving(true)
    try {
      const out = await renderPhoto(source, adj)
      await savePhoto({ date, view, notes, ...out })
      const done = [...savedViews, view]
      setSavedViews(done)
      setSource(null)
      setPreview(null)
      setNotes('')
      const next = PHOTO_VIEWS.find((v) => !done.includes(v))
      if (next) setView(next)
      else nav('/progress/photos')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save photo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Progress photo" back="/progress/photos" subtitle="Same spot, lighting, clothing and distance each time." />
      <PrivacyNote />
      <Segmented label="View" value={view} onChange={setView} options={PHOTO_VIEWS.map((v) => ({ value: v, label: `${VIEW_LABEL[v]}${savedViews.includes(v) ? ' ✓' : ''}` }))} />
      <Field label="Date" htmlFor="ph-date"><Input id="ph-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take photo with camera" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={library} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/*" className="hidden" aria-label="Upload photo from library" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!source ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" size="lg" onClick={() => camera.current?.click()}><Camera className="h-5 w-5" aria-hidden /> Take photo</Button>
          <Button size="lg" onClick={() => library.current?.click()}><ImageUp className="h-5 w-5" aria-hidden /> Upload photo</Button>
        </div>
      ) : (
        <Card className="space-y-3">
          {preview && <img src={preview} alt="Preview of adjusted photo" className="mx-auto max-h-[60dvh] rounded-xl" />}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setAdj({ ...adj, rotation: ((adj.rotation + 90) % 360) as Adjustments['rotation'] })}><RotateCw className="h-4 w-4" aria-hidden /> Rotate</Button>
            <Select aria-label="Crop shape" value={adj.aspect === null ? 'orig' : adj.aspect === 1 ? 'sq' : 'p'} onChange={(e) => setAdj({ ...adj, aspect: e.target.value === 'orig' ? null : e.target.value === 'sq' ? 1 : 3 / 4 })}>
              <option value="p">Crop 3:4 portrait</option>
              <option value="sq">Crop square</option>
              <option value="orig">Original shape</option>
            </Select>
          </div>
          <Slider label="Zoom" min={1} max={2.5} step={0.05} value={adj.zoom} onChange={(v) => setAdj({ ...adj, zoom: v })} />
          <Slider label="Move left/right" min={-1} max={1} step={0.02} value={adj.offsetX} onChange={(v) => setAdj({ ...adj, offsetX: v })} />
          <Slider label="Move up/down" min={-1} max={1} step={0.02} value={adj.offsetY} onChange={(v) => setAdj({ ...adj, offsetY: v })} />
          <p className="text-xs text-faint">Cropping and zoom keep proportions — the app never stretches, reshapes or retouches photos.</p>
          <Field label="Notes (optional)" htmlFor="ph-notes"><Textarea id="ph-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => { setSource(null); setPreview(null); camera.current?.click() }}>Retake</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save ${VIEW_LABEL[view].toLowerCase()}`}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 block h-8 w-full accent-[#51cea7]" />
    </label>
  )
}

export function ComparePhotos() {
  const all = useLiveQuery(() => listPhotos(), [])
  const [view, setView] = useState<PhotoView>('front')
  const ofView = useMemo(() => (all ?? []).filter((p) => p.view === view).sort((a, b) => a.date.localeCompare(b.date)), [all, view])
  const [aId, setA] = useState<string>('')
  const [bId, setB] = useState<string>('')
  const [mode, setMode] = useState<'side' | 'slider' | 'overlay'>('side')
  const [reveal, setReveal] = useState(50)
  const [opacity, setOpacity] = useState(50)
  const [align, setAlign] = useState({ scale: 1, x: 0, y: 0 })
  const [full, setFull] = useState<ProgressPhoto | null>(null)
  if (!all) return null
  const a = ofView.find((p) => p.id === aId) ?? ofView[0]
  const b = ofView.find((p) => p.id === bId) ?? ofView.at(-1)
  const bStyle = { transform: `translate(${align.x}%, ${align.y}%) scale(${align.scale})` }
  return (
    <div className="space-y-4">
      <PageHeader title="Compare photos" back="/progress/photos" />
      <Segmented label="View" value={view} onChange={(v) => { setView(v); setA(''); setB('') }} options={PHOTO_VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v] }))} />
      {ofView.length < 2 ? (
        <Empty title="Need two dates to compare">{ofView.length === 0 ? `No ${view} photos yet.` : `Only one ${view} photo so far.`} <Link to="/progress/photos/new" className="text-accent">Take a photo</Link></Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Earlier" htmlFor="cmp-a">
              <Select id="cmp-a" value={a?.id} onChange={(e) => setA(e.target.value)}>{ofView.map((p) => <option key={p.id} value={p.id}>{formatUK(p.date)}</option>)}</Select>
            </Field>
            <Field label="Later" htmlFor="cmp-b">
              <Select id="cmp-b" value={b?.id} onChange={(e) => setB(e.target.value)}>{ofView.map((p) => <option key={p.id} value={p.id}>{formatUK(p.date)}</option>)}</Select>
            </Field>
          </div>
          <Segmented label="Comparison mode" value={mode} onChange={setMode} options={[{ value: 'side', label: 'Side by side' }, { value: 'slider', label: 'Slider' }, { value: 'overlay', label: 'Overlay' }]} />
          {a && b && mode === 'side' && (
            <div className="grid grid-cols-2 gap-2">
              {[a, b].map((p) => (
                <figure key={p.id} className="relative">
                  <PhotoImg photo={p} className="aspect-[3/4] w-full rounded-xl object-contain bg-black" />
                  <figcaption className="mt-1 flex items-center justify-between text-sm text-muted">{formatUK(p.date)}
                    <button type="button" aria-label={`Full screen ${formatUK(p.date)}`} className="p-1" onClick={() => setFull(p)}><Maximize2 className="h-4 w-4" /></button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {a && b && mode !== 'side' && (
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
              <PhotoImg photo={a} className="absolute inset-0 h-full w-full object-contain" />
              <div className="absolute inset-0" style={mode === 'slider' ? { clipPath: `inset(0 0 0 ${reveal}%)` } : { opacity: opacity / 100 }}>
                <PhotoImg photo={b} className="h-full w-full object-contain" style={bStyle} />
              </div>
              {mode === 'slider' && <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${reveal}%` }} />}
              <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">{formatUK(a.date)}</span>
              <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">{formatUK(b.date)}</span>
            </div>
          )}
          {mode === 'slider' && <Slider label="Drag to reveal the later photo" min={0} max={100} step={1} value={reveal} onChange={setReveal} />}
          {mode === 'overlay' && <Slider label={`Later photo opacity: ${opacity}%`} min={0} max={100} step={1} value={opacity} onChange={setOpacity} />}
          {mode !== 'side' && (
            <Card className="space-y-1">
              <p className="text-sm font-semibold">Align the later photo</p>
              <Slider label="Scale" min={0.8} max={1.25} step={0.01} value={align.scale} onChange={(v) => setAlign({ ...align, scale: v })} />
              <Slider label="Shift left/right" min={-15} max={15} step={0.5} value={align.x} onChange={(v) => setAlign({ ...align, x: v })} />
              <Slider label="Shift up/down" min={-15} max={15} step={0.5} value={align.y} onChange={(v) => setAlign({ ...align, y: v })} />
              <Button size="sm" variant="ghost" onClick={() => setAlign({ scale: 1, x: 0, y: 0 })}>Reset alignment</Button>
            </Card>
          )}
          <p className="text-xs text-faint">The app does not estimate body-fat percentage or reshape images. Lighting, posture and time of day all affect how photos look.</p>
        </>
      )}
      {full && <FullScreen photo={full} onClose={() => setFull(null)} />}
    </div>
  )
}

/** Full-screen viewer with pinch-zoom / pan (pointer events) and double-tap reset. */
function FullScreen({ photo, onClose }: { photo: ProgressPhoto; onClose: () => void }) {
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef<{ dist: number; scale: number; x: number; y: number; cx: number; cy: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ps = [...pointers.current.values()]
    const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length
    const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length
    const dist = ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0
    start.current = { dist, scale: t.scale, x: t.x, y: t.y, cx, cy }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !start.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ps = [...pointers.current.values()]
    const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length
    const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length
    const s0 = start.current
    const scale = ps.length > 1 && s0.dist > 0 ? Math.min(5, Math.max(1, (s0.scale * Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)) / s0.dist)) : s0.scale
    setT({ scale, x: s0.x + (cx - s0.cx), y: s0.y + (cy - s0.cy) })
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    start.current = null
    if (pointers.current.size) onDown(e)
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Full screen photo" className="fixed inset-0 z-50 flex items-center justify-center bg-black" style={{ touchAction: 'none' }}>
      <div className="h-full w-full" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={() => setT({ scale: 1, x: 0, y: 0 })}
        onWheel={(e) => setT((v) => ({ ...v, scale: Math.min(5, Math.max(1, v.scale - e.deltaY * 0.002)) }))}>
        <PhotoImg photo={photo} className="h-full w-full select-none object-contain" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }} />
      </div>
      <Button size="icon" className="pt-safe absolute right-3 top-3" aria-label="Close full screen" onClick={onClose}><X className="h-5 w-5" /></Button>
      <p className="pb-safe absolute bottom-3 text-sm text-muted">{formatUK(photo.date)} · pinch to zoom · double-tap to reset</p>
    </div>
  )
}

