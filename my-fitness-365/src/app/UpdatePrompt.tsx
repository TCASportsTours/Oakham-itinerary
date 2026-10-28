import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'

/** Registers the service worker (production only) and offers a reload when a new version is ready. */
export function UpdatePrompt() {
  const [update, setUpdate] = useState<null | (() => void)>(null)
  useEffect(() => {
    if (!import.meta.env.PROD || import.meta.env.VITE_EMBED || !('serviceWorker' in navigator)) return
    import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
      })
    })
  }, [])
  if (!update) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 mx-auto flex max-w-xl items-center gap-3 bg-surface p-3 pt-safe shadow-xl">
      <span className="flex-1 text-sm">A new version of My Fitness 365 is ready.</span>
      <Button size="sm" variant="primary" onClick={update}>Update</Button>
    </div>
  )
}
