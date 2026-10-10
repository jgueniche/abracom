"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { APP_HOME_PATH, LOGIN_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/temporary-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";

export type PasswordChangeState = { status: "idle" | "success" | "error"; message?: string };

const choiceSchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  confirm: z.string().max(PASSWORD_MAX_LENGTH),
});

type Translate = Awaited<ReturnType<typeof getTranslations<"password">>>;

/** Reads the two fields; returns the password, or what is wrong with them in French. */
function readChoice(formData: FormData, t: Translate): { password: string } | { error: string } {
  const parsed = choiceSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { error: t("tooShort", { min: PASSWORD_MIN_LENGTH }) };
  if (parsed.data.password !== parsed.data.confirm) return { error: t("mismatch") };
  return { password: parsed.data.password };
}

/**
 * Writes the new password and lifts the « provisional » mark in one call, with
 * the service key: the person's own session is enough to prove who they are,
 * and this way the change does not depend on how recent that session is.
 *
 * Supabase Auth then closes **every** session of the account — this one too:
 * its refresh token is gone (measured: « Refresh Token Not Found »). Other
 * devices are signed out at their next refresh, which is what a password change
 * should do; this browser signs in again at once with the new password, and the
 * new token no longer carries the mark.
 */
async function storePassword(
  user: { id: string; email: string },
  password: string,
): Promise<"ok" | "weak" | "signed-out"> {
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { password_provisional: null },
  });
  if (error) {
    if (error.code === "weak_password" || error.status === 422) return "weak";
    throw new Error(error.message);
  }
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  return signInError ? "signed-out" : "ok";
}

/**
 * The first sign-in with a password the school gave (ADR-0075): nothing opens
 * until the person has chosen their own.
 */
export async function chooseMyPassword(
  _previous: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const t = await getTranslations("password");
  const user = await requireCurrentUser();
  if (!user.passwordProvisional) redirect(APP_HOME_PATH);
  if (!user.email) return { status: "error", message: t("unavailable") };

  const choice = readChoice(formData, t);
  if ("error" in choice) return { status: "error", message: choice.error };
  const stored = await storePassword({ id: user.id, email: user.email }, choice.password);
  if (stored === "weak") return { status: "error", message: t("weak") };
  // The password is changed; should the new session not open, signing in with it is the way on.
  redirect(stored === "ok" ? APP_HOME_PATH : LOGIN_PATH);
}

/** « Changer mon mot de passe », from the profile: the current one is asked first. */
export async function changeMyPassword(
  _previous: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const t = await getTranslations("password");
  const user = await requireCurrentUser();
  const current = String(formData.get("current") ?? "");
  if (!user.email || current.length === 0 || current.length > 200) {
    return { status: "error", message: t("wrongCurrent") };
  }
  const choice = readChoice(formData, t);
  if ("error" in choice) return { status: "error", message: choice.error };

  // A separate, session-less sign-in checks the current password without
  // touching the session this page runs in; the session it opens is closed.
  const check = createAnonClient();
  const { error } = await check.auth.signInWithPassword({ email: user.email, password: current });
  if (error?.status === 429) return { status: "error", message: t("rateLimited") };
  if (error) return { status: "error", message: t("wrongCurrent") };
  await check.auth.signOut({ scope: "local" });

  const stored = await storePassword({ id: user.id, email: user.email }, choice.password);
  if (stored === "weak") return { status: "error", message: t("weak") };
  if (stored === "signed-out") redirect(LOGIN_PATH);
  return { status: "success", message: t("changed") };
}
