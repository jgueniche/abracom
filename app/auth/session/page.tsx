"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/client";

/**
 * Implicit-flow landing: the session arrives in the URL fragment.
 *
 * An invitation sent with Supabase's own e-mail template points at
 * `/auth/v1/verify`, which redirects to the application with the tokens in a
 * `#access_token=…` fragment — the browser never sends a fragment to the
 * server, so `/auth/callback` found no `code`, assumed a dead link and sent the
 * family back to the sign-in page with an error. Invited parents simply could
 * not get in. The project's own e-mail templates use the token-hash flow that
 * `/auth/confirm` handles server-side, but they only take effect once a custom
 * SMTP sender is configured, and links already sent keep this shape either way.
 *
 * The page is deliberately silent: it establishes the session and moves on.
 */
export default function AuthSessionPage() {
  const t = useTranslations("auth.login");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const next = safeNextPath(query.get("next"));
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");

    if (!accessToken || !refreshToken) {
      window.location.replace(`${LOGIN_PATH}?error=link`);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        // the fragment is dropped by `replace`, so the tokens leave the address bar
        window.location.replace(error ? `${LOGIN_PATH}?error=link` : next);
      } catch {
        if (!cancelled) window.location.replace(`${LOGIN_PATH}?error=link`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Shown for the instant before the redirect, and to anyone without scripting.
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 text-center">
      <p role="status" className="text-sm text-muted-foreground">
        {t("signingIn")}
      </p>
    </main>
  );
}
