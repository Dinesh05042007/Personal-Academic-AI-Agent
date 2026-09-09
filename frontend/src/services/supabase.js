import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://jtxatrfkxuzeyfhcqlhd.supabase.co";

// Browser-safe Supabase credentials (publishable or anon key only, never secret key)
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

// Safe initialize browser Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey || "dummy-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
