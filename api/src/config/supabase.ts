
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Used only to verify incoming user access tokens.
export const supabaseAuth = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession    : false,
      autoRefreshToken  : false,
      detectSessionInUrl: false,
    },
  },
);

// Server-only client for protected database operations.
export const supabaseAdmin = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      persistSession    : false,
      autoRefreshToken  : false,
      detectSessionInUrl: false,
    },
  },
);
