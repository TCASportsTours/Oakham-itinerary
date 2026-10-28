import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/data/supabase'
import { Button, Card, Field, Input, Segmented } from '@/components/ui'
import { Logo } from '@/components/Logo'

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(8, 'At least 8 characters') })
type Form = z.infer<typeof schema>

export function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email, password }: Form) => {
    setError(null)
    setMessage(null)
    if (!supabase) return
    const res = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    if (res.error) setError(res.error.message)
    else if (mode === 'up' && !res.data.session) setMessage('Check your email to confirm your account, then sign in.')
  }

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 pb-10">
      <div className="mb-8 flex items-center gap-3">
        <Logo className="h-12 w-12" />
        <div>
          <h1 className="text-3xl">My Fitness 365</h1>
          <p className="text-muted">Your private training & nutrition diary</p>
        </div>
      </div>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Segmented label="Account" value={mode} onChange={setMode} options={[{ value: 'in', label: 'Sign in' }, { value: 'up', label: 'Create account' }]} />
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} {...register('password')} />
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {message && <p role="status" className="text-sm text-accent">{message}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={formState.isSubmitting}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-xs text-faint">Progress photos are stored in a private bucket only you can access.</p>
    </div>
  )
}
