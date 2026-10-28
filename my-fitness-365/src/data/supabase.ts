import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, cloudConfigured } from '@/lib/env'

/** Public (anon) client only. Row-level security on the server is the access control. */
export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export const PHOTO_BUCKET = 'progress-photos'
