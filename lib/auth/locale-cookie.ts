import type { NextResponse } from "next/server";

import { LOCALE_COOKIE } from "@/lib/i18n/config";
import type { createClient } from "@/lib/supabase/server";

/** The UI language follows the profile as soon as the user is signed in. */
export async function syncLocaleCookie(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | undefined,
  response: NextResponse,
): Promise<void> {
  if (!userId) return;
  const { data } = await supabase.from("profiles").select("locale").eq("id", userId).maybeSingle();
  if (data?.locale) {
    response.cookies.set(LOCALE_COOKIE, data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
}
