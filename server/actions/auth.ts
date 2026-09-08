"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { MissingSupabaseConfigError, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

const magicLinkSchema = z.object({
  email: z.email().max(254),
});

/**
 * Sends a magic link to an existing account. Unknown addresses receive the same
 * answer as known ones (no account enumeration); sign-up is never allowed here.
 */
export async function requestMagicLink(
  _previous: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const t = await getTranslations("auth.login");
  const parsed = magicLinkSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  });
  if (!parsed.success) return { status: "error", message: t("invalidEmail") };

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      return { status: "error", message: t("notConfigured") };
    }
    throw error;
  }

  const next = safeNextPath(formData.get("next"));
  const origin = (await headers()).get("origin") ?? publicEnv.NEXT_PUBLIC_SITE_URL;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error?.status === 429) return { status: "error", message: t("rateLimited") };
  if (error) console.warn("[auth] signInWithOtp:", error.message);

  return { status: "sent", email: parsed.data.email };
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
