import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Session-less client with the anonymous key, for public Route Handlers that authenticate
 * with their own secret (the ICS feed token). Every query still goes through RLS as `anon`.
 */
export function createAnonClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
