import { createClient } from '@supabase/supabase-js'
// Public browser credentials. Database RLS enforces access.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://hxzdjfxyzefjjrmplowu.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_qsADvS7szaNZhzzdxFMuqw_lM2FQc0u'
)
