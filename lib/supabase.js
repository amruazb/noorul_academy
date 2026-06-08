import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

export const supabaseBrowser =
  supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null;

export const supabaseAdmin =
  supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;
