"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Supabase client for Client Components (anon key + user session cookies, RLS enforced). */
export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, anonKey);
}
