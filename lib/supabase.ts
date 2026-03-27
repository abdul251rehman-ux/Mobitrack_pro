import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-project-url') {
    // Return a dummy client during build or when env vars are not set
    // This prevents build failures — runtime calls will fail gracefully
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSupabaseClient()
