"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { MissingSupabaseConfigError, publicEnv } from "@/lib/env";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
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

export type PasswordState = {
  status: "idle" | "error";
  message?: string;
};

const passwordSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

/**
 * Password sign-in for the accounts that hold one (demo accounts, first administrator —
 * ADR-0028). The magic link stays the default flow; there is no sign-up and no reset here.
 */
export async function signInWithPassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const t = await getTranslations("auth.login");
  const parsed = passwordSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: t("invalidCredentials") };

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      return { status: "error", message: t("notConfigured") };
    }
    throw error;
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.status === 429) return { status: "error", message: t("rateLimited") };
  // Network failure (no status) rather than a refusal: the service is unreachable.
  if (error && !error.status) return { status: "error", message: t("unavailable") };
  if (error || !data.user) return { status: "error", message: t("invalidCredentials") };

  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.locale) {
    (await cookies()).set(LOCALE_COOKIE, profile.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  redirect(safeNextPath(formData.get("next")));
}

/** Signs out; the push subscription of this browser is forgotten so a shared device stays quiet. */
export async function signOut(pushEndpoint?: string | null): Promise<never> {
  const supabase = await createClient();
  if (typeof pushEndpoint === "string" && pushEndpoint.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", pushEndpoint);
    }
  }
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
