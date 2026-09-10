import { type NextRequest, NextResponse } from "next/server";

import { syncLocaleCookie } from "@/lib/auth/locale-cookie";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/** PKCE code exchange after a magic link / invitation e-mail. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      await syncLocaleCookie(supabase, data.user?.id, response);
      return response;
    }
  }

  // No code: the link came from Supabase's own template, which sends the session
  // in a URL fragment the server never sees. Hand it to the client page that can
  // read it — the browser carries the fragment across this redirect.
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/session?next=${encodeURIComponent(next)}`);
  }

  return NextResponse.redirect(`${origin}${LOGIN_PATH}?error=link`);
}
