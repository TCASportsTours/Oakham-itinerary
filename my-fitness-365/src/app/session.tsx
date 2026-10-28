import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useConfirm } from '@/components/confirm'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/data/supabase'
import { setSession } from '@/data/repo'
import { seedUser } from '@/data/seed'
import { pendingCount, startAutoSync, syncNow, type SyncResult } from '@/data/sync'
import { cloudConfigured } from '@/lib/env'
import { clearPhotoCache } from '@/services/photos'
import { getProfile, getSettings } from '@/services/profile'
import { wipeLocalData } from '@/services/backup'

export const LOCAL_USER_ID = 'local-user'

interface SessionState {
  mode: 'local' | 'cloud'
  status: 'loading' | 'signed-out' | 'ready'
  userId: string | null
  email: string | null
  lastSync: SyncResult | null
  error: string | null
  signOut: () => Promise<{ ok: boolean; pending: number }>
  sync: () => Promise<void>
}

const Ctx = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Session | null | undefined>(cloudConfigured ? undefined : null)
  const [userId, setUserId] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setAuth(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuth(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Boot the local data store for whoever is signed in.
  useEffect(() => {
    let cancelled = false
    let stopSync: (() => void) | undefined
    ;(async () => {
      try {
        if (!cloudConfigured) {
          setSession(LOCAL_USER_ID, false)
          await seedUser(LOCAL_USER_ID)
          if (!cancelled) setUserId(LOCAL_USER_ID)
          return
        }
        if (auth === undefined) return
        if (auth === null) {
          setUserId(null)
          return
        }
        const uid = auth.user.id
        setSession(uid, true)
        // Pull first so another device's data wins over fresh seed rows.
        if (navigator.onLine) setLastSync(await syncNow().catch(() => null))
        await seedUser(uid)
        if (cancelled) return
        setUserId(uid)
        stopSync = startAutoSync((r) => setLastSync(r))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
      stopSync?.()
    }
  }, [auth])

  const signOut = useCallback(async () => {
    if (supabase) {
      await syncNow().catch(() => undefined)
      const pending = await pendingCount()
      if (pending > 0 && !(await confirm({ title: 'Sign out?', message: `${pending} change(s) have not reached the cloud yet and will be lost if you sign out now.`, confirmLabel: 'Sign out anyway', destructive: true }))) {
        return { ok: false, pending }
      }
      await supabase.auth.signOut()
    }
    // Sensitive local state (records, cached photos) is cleared on sign-out.
    clearPhotoCache()
    await wipeLocalData()
    setUserId(null)
    if (!supabase) window.location.reload()
    return { ok: true, pending: 0 }
  }, [confirm])

  const sync = useCallback(async () => {
    setLastSync(await syncNow())
  }, [])

  const status: SessionState['status'] = userId ? 'ready' : cloudConfigured && auth === null ? 'signed-out' : 'loading'

  return (
    <Ctx.Provider value={{ mode: cloudConfigured ? 'cloud' : 'local', status, userId, email: auth?.user.email ?? null, lastSync, error, signOut, sync }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}

export function useProfile() {
  const { userId } = useSession()
  return useLiveQuery(() => getProfile(), [userId])
}

export function useSettings() {
  const { userId } = useSession()
  return useLiveQuery(() => getSettings(), [userId])
}
