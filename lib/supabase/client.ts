"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/env";

/**
 * Supabase client for Client Components (anon key + user session cookies).
 * Typed `Database` generics arrive with the schema (session 3).
 */
export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
