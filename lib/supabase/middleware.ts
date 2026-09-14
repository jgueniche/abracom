import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig, MissingSupabaseConfigError } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export type SessionResult = {
  response: NextResponse;
  /** Identifier of the signed-in user, read from the verified JWT. */
  userId: string | null;
  /** false when Supabase is not configured (early sessions, previews without env vars). */
  configured: boolean;
};

/**
 * Refreshes the Supabase auth cookies on every request (the @supabase/ssr pattern),
 * and answers the only question the middleware asks: is there a valid session?
 *
 * It used to answer it with `getUser()`, which is an HTTP round trip to the auth
 * server — 53 ms with the database on the same machine, more over the network.
 * The middleware runs on *every* request, and the App Router prefetches every
 * link in the viewport: one visit to the home page fired 28 of them, 25 of which
 * were for pages nobody had asked for (ADR-0061).
 *
 * `getClaims()` verifies the token's ES256 signature locally against the
 * project's JWKS, which is cached in a module-level map for the life of the
 * process — so the cost is zero after the first request of a cold start. It
 * still goes through `getSession()`, so an expired token is refreshed and the
 * rotated cookies are written exactly as before.
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
        userId: null,
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

  // A tampered or expired token yields no claims; anything unexpected is treated
  // as "no session", which the caller turns into a redirect to the sign-in page.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return { response, userId, configured: true };
}
