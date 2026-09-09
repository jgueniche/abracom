import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client: bypasses RLS. Server-side only, for trusted jobs
 * (CSV import, invitations, notification queue). Every use must be preceded by
 * an explicit role check (`lib/permissions`) and written to `audit_log`.
 */
export function createAdminClient() {
  const { url } = getSupabasePublicConfig();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante : client admin indisponible.");
  }

  return createSupabaseClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
