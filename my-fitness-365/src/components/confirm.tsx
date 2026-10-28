import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button, Field, Input, Sheet } from './ui'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  /** When set, the user must type this word before confirming. */
  requireText?: string
}

type Ask = (o: ConfirmOptions) => Promise<boolean>
const Ctx = createContext<Ask | null>(null)

/** In-app confirmation sheet (native confirm()/prompt() are unavailable in some embedded views). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const ask = useCallback<Ask>((o) => {
    setTyped('')
    setOpts(o)
    return new Promise<boolean>((res) => (resolver.current = res))
  }, [])
  const close = (v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Sheet open={!!opts} onClose={() => close(false)} title={opts?.title ?? ''}>
        {opts && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!opts.requireText || typed === opts.requireText) close(true)
            }}
          >
            <p className="text-muted">{opts.message}</p>
            {opts.requireText && (
              <Field label={`Type ${opts.requireText} to confirm`} htmlFor="confirm-text">
                <Input id="confirm-text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => close(false)}>Cancel</Button>
              <Button type="submit" variant={opts.destructive ? 'danger' : 'primary'} disabled={!!opts.requireText && typed !== opts.requireText}>
                {opts.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </Ctx.Provider>
  )
}

export function useConfirm() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConfirm outside ConfirmProvider')
  return v
}
