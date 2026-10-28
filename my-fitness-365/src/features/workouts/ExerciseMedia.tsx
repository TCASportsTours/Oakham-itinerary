import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dumbbell, ImagePlus, PlayCircle, Trash2, VideoOff } from 'lucide-react'
import { db } from '@/data/db'
import { create, getUserId, remove, update, where } from '@/data/repo'
import { nowIso } from '@/lib/dates'
import { Button, Collapsible, Field, Input } from '@/components/ui'
import type { Exercise, ExerciseMedia } from '@/data/types'

/** First user-added image for an exercise, as an object URL (device-local). */
function useMediaUrl(media: ExerciseMedia | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    if (!media) return setUrl(null)
    db.blobs.get(media.id).then((b) => {
      if (b) {
        u = URL.createObjectURL(b.blob)
        setUrl(u)
      } else setUrl(media.url)
    })
    return () => {
      if (u) URL.revokeObjectURL(u)
    }
  }, [media])
  return url
}

export function ExerciseThumb({ exercise, className = 'h-14 w-14' }: { exercise: Exercise; className?: string }) {
  const media = useLiveQuery(() => where('exercise_media', 'exercise_id', exercise.id), [exercise.id])
  const url = useMediaUrl(media?.find((m) => m.label === 'start') ?? media?.[0])
  return url ? (
    <img src={url} alt={`${exercise.name}`} className={`${className} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent`} aria-hidden>
      <Dumbbell className="h-6 w-6" />
    </div>
  )
}

function MediaTile({ media, label }: { media: ExerciseMedia; label: string }) {
  const url = useMediaUrl(media)
  return (
    <figure className="relative">
      {url && <img src={url} alt={label} className="aspect-square w-full rounded-xl object-cover" />}
      <figcaption className="mt-1 flex items-center justify-between text-xs text-muted">
        {label}
        <button
          type="button"
          className="p-1 text-faint hover:text-danger"
          aria-label={`Remove ${label}`}
          onClick={async () => {
            await db.blobs.delete(media.id)
            await remove('exercise_media', media.id)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </figcaption>
    </figure>
  )
}

/** Start/finish position images. None are bundled (no licensed set yet); users can add their own photos. */
export function ExerciseImages({ exercise }: { exercise: Exercise }) {
  const media = useLiveQuery(() => where('exercise_media', 'exercise_id', exercise.id), [exercise.id]) ?? []
  const input = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState<'start' | 'finish'>('start')
  const add = async (file: File) => {
    const id = crypto.randomUUID()
    await db.blobs.put({ id, user_id: getUserId(), blob: file, created_at: nowIso() })
    await create('exercise_media', { id, exercise_id: exercise.id, kind: 'image', label, storage: 'local', url: null, source: 'Added by you (stored on this device)' })
  }
  return (
    <div className="space-y-2">
      {media.length === 0 ? (
        <p className="text-sm">No licensed demonstration images are bundled yet. You can add your own start and finish photos (kept on this device only).</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {media.map((m) => (
            <MediaTile key={m.id} media={m} label={m.label === 'start' ? 'Start position' : m.label === 'finish' ? 'Finish position' : 'Image'} />
          ))}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && add(e.target.files[0])} aria-label="Choose exercise image" />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { setLabel('start'); setTimeout(() => input.current?.click()) }}>
          <ImagePlus className="h-4 w-4" aria-hidden /> Add start photo
        </Button>
        <Button size="sm" onClick={() => { setLabel('finish'); setTimeout(() => input.current?.click()) }}>
          <ImagePlus className="h-4 w-4" aria-hidden /> Add finish photo
        </Button>
      </div>
    </div>
  )
}

function youTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m?.[1] ?? null
}

/** Collapsible video. The player iframe is only created when the user opens it. */
export function ExerciseVideo({ exercise }: { exercise: Exercise }) {
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(exercise.video_url ?? '')
  const id = exercise.video_url ? youTubeId(exercise.video_url) : null
  return (
    <Collapsible title="Video demonstration" icon={<PlayCircle className="h-5 w-5 text-accent" aria-hidden />}>
      {id ? (
        <div className="space-y-2">
          {show ? (
            <iframe
              className="aspect-video w-full rounded-xl"
              src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
              title={`${exercise.name} demonstration`}
              allow="accelerometer; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <Button onClick={() => setShow(true)} className="w-full">
              <PlayCircle className="h-5 w-5" aria-hidden /> Load video
            </Button>
          )}
          <p className="text-xs text-faint">
            {exercise.video_verified ? `Source: ${exercise.video_source}` : 'Added by you — not verified by the app.'}
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm">
          <VideoOff className="h-4 w-4 shrink-0" aria-hidden /> Video unavailable — no verified demonstration has been added yet. The written instructions above still apply.
        </p>
      )}
      <div className="mt-2">
        {editing ? (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const clean = url.trim()
              if (clean && !youTubeId(clean)) return
              await update('exercises', exercise.id, { video_url: clean || null, video_source: clean ? 'Added by you' : null, video_verified: false })
              setEditing(false)
            }}
          >
            <Field label="YouTube link" htmlFor={`vid-${exercise.id}`} hint="Paste a YouTube link from a coach or organisation you trust.">
              <Input id={`vid-${exercise.id}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
            </Field>
            {url.trim() && !youTubeId(url.trim()) && <p className="text-sm text-danger">That doesn’t look like a YouTube link.</p>}
            <Button type="submit" size="sm">Save link</Button>
          </form>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {exercise.video_url ? 'Change video link' : 'Add your own video link'}
          </Button>
        )}
      </div>
    </Collapsible>
  )
}
