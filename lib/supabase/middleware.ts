import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig, MissingSupabaseConfigError } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export type SessionResult = {
  response: NextResponse;
  user: User | null;
  /** false when Supabase is not configured (early sessions, previews without env vars). */
  configured: boolean;
};

/**
 * Refreshes the Supabase auth cookies on every request (the @supabase/ssr pattern):
 * `getUser()` validates the JWT with the auth server and rotates expired tokens.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers = request.headers,
): Promise<SessionResult> {
  let config: { url: string; anonKey: string };
  try {
    config = getSupabasePublicConfig();
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      return {
        response: NextResponse.next({ request: { headers: requestHeaders } }),
        user: null,
        configured: false,
      };
    }
    throw error;
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, configured: true };
}
