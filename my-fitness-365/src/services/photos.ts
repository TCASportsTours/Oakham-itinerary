import { db } from '@/data/db'
import { create, getUserId, isSyncEnabled, list, remove } from '@/data/repo'
import { supabase, PHOTO_BUCKET } from '@/data/supabase'
import { nowIso } from '@/lib/dates'
import type { PhotoView, ProgressPhoto } from '@/data/types'

export const MAX_PHOTO_DIMENSION = 1600

/**
 * Decode an image file. Browsers apply EXIF orientation when decoding with
 * imageOrientation 'from-image' (and by default in current Safari/Chrome).
 * HEIC decodes only where the browser supports it (Safari on iOS does; iOS
 * also usually hands web pages a JPEG when picking from the library).
 */
export async function decodeImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fall through to <img> decode */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } catch {
    throw new Error('This image format could not be read on this device. Try a JPEG or PNG.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface Adjustments {
  rotation: 0 | 90 | 180 | 270
  /** Zoom ≥ 1 crops in from the centre; offsets in −1…1 shift the crop window. */
  zoom: number
  offsetX: number
  offsetY: number
  /** Output aspect ratio (w/h), or null to keep the original. */
  aspect: number | null
}

export const defaultAdjustments: Adjustments = { rotation: 0, zoom: 1, offsetX: 0, offsetY: 0, aspect: 3 / 4 }

/** Rotate, crop (uniform scale only — never distorts the body) and encode as JPEG. */
export async function renderPhoto(src: ImageBitmap | HTMLImageElement, adj: Adjustments): Promise<{ blob: Blob; width: number; height: number }> {
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height
  const rotated = adj.rotation % 180 !== 0
  const rw = rotated ? sh : sw
  const rh = rotated ? sw : sh
  // Crop window in rotated space
  const aspect = adj.aspect ?? rw / rh
  let cw = rw
  let ch = rw / aspect
  if (ch > rh) {
    ch = rh
    cw = rh * aspect
  }
  cw /= adj.zoom
  ch /= adj.zoom
  const cx = (rw - cw) / 2 + ((rw - cw) / 2) * adj.offsetX
  const cy = (rh - ch) / 2 + ((rh - ch) / 2) * adj.offsetY
  const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(cw, ch))
  const outW = Math.round(cw * scale)
  const outH = Math.round(ch * scale)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  // Draw rotated image into rotated space
  ctx.translate(rw / 2, rh / 2)
  ctx.rotate((adj.rotation * Math.PI) / 180)
  ctx.drawImage(src, -sw / 2, -sh / 2)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encoding failed'))), 'image/jpeg', 0.86))
  return { blob, width: outW, height: outH }
}

export async function savePhoto(input: { date: string; view: PhotoView; blob: Blob; width: number; height: number; notes: string }) {
  const cloud = isSyncEnabled()
  const id = crypto.randomUUID()
  // Store the file first so the metadata never points at nothing.
  await db.blobs.put({ id, user_id: getUserId(), blob: input.blob, created_at: nowIso() })
  return create('progress_photos', {
    id,
    date: input.date,
    view: input.view,
    storage: cloud ? 'cloud' : 'local',
    storage_path: null,
    width: input.width,
    height: input.height,
    mime: 'image/jpeg',
    notes: input.notes,
    uploaded: false,
  })
}

export async function photos(): Promise<ProgressPhoto[]> {
  return (await list('progress_photos')).sort((a, b) => b.date.localeCompare(a.date) || a.view.localeCompare(b.view))
}

/** In-memory only object URLs for cloud photos. Cleared on sign-out. */
const urlCache = new Map<string, string>()

export async function photoUrl(photo: ProgressPhoto): Promise<string | null> {
  const cached = urlCache.get(photo.id)
  if (cached) return cached
  let blob: Blob | undefined = (await db.blobs.get(photo.id))?.blob
  if (!blob && photo.storage === 'cloud' && photo.storage_path && supabase) {
    // Authenticated download through RLS-protected storage; no public or long-lived URLs.
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(photo.storage_path)
    if (error) throw error
    blob = data
  }
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(photo.id, url)
  return url
}

export async function deletePhoto(photo: ProgressPhoto) {
  const url = urlCache.get(photo.id)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(photo.id)
  if (isSyncEnabled() && photo.storage === 'cloud') {
    // Tombstone; the sync engine deletes the storage object and the server row together.
    await db.blobs.delete(photo.id)
    await remove('progress_photos', photo.id)
  } else {
    await db.transaction('rw', db.progress_photos, db.blobs, async () => {
      await db.progress_photos.delete(photo.id)
      await db.blobs.delete(photo.id)
    })
  }
}

export function clearPhotoCache() {
  urlCache.forEach((u) => URL.revokeObjectURL(u))
  urlCache.clear()
}

export const PHOTO_VIEWS: PhotoView[] = ['front', 'side', 'back']
