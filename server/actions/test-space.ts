"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { APP_HOME_PATH, PERSPECTIVE_COOKIE, SCHOOL_COOKIE } from "@/lib/auth/routes";
import { isTestSchool } from "@/lib/auth/school-choice";
import { TEST_PERSONA_KEYS, TEST_PERSONAS } from "@/lib/auth/test-space";
import { MissingSupabaseConfigError } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type TestSpaceState = { status: "idle" | "error"; message?: string };

const schema = z.object({
  password: z.string().min(1).max(200),
  persona: z.enum(TEST_PERSONA_KEYS),
});

/**
 * The « Espace de test » door (ADR-0073): the test school's one password, and the
 * character to enter as. It is an ordinary password sign-in on a fixed account —
 * Supabase Auth counts the attempts as it does on the sign-in page — followed by
 * a check that the account opened belongs to the test school **and nowhere
 * else**: should a real school or the platform ever be given to one of these
 * accounts, the door would refuse it rather than open the real thing.
 */
export async function enterTestSpace(
  _previous: TestSpaceState,
  formData: FormData,
): Promise<TestSpaceState> {
  const t = await getTranslations("testSchool");
  const parsed = schema.safeParse({
    password: String(formData.get("password") ?? ""),
    persona: formData.get("persona"),
  });
  if (!parsed.success) return { status: "error", message: t("incomplete") };

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      return { status: "error", message: t("unavailable") };
    }
    throw error;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_PERSONAS[parsed.data.persona],
    password: parsed.data.password,
  });
  if (error?.status === 429) return { status: "error", message: t("rateLimited") };
  if (error && !error.status) return { status: "error", message: t("unavailable") };
  if (error || !data.user) return { status: "error", message: t("wrongPassword") };

  const { data: rows } = await supabase
    .from("memberships")
    .select("role, status, school:schools(id, modules)")
    .eq("user_id", data.user.id);
  const memberships = rows ?? [];
  const school = memberships.find((m) => m.status === "active" && isTestSchool(m.school))?.school;
  const elsewhere = memberships.some((m) => m.role === "super_admin" || !isTestSchool(m.school));
  if (!school || elsewhere) {
    await supabase.auth.signOut();
    return { status: "error", message: t("wrongPassword") };
  }

  const store = await cookies();
  store.set(SCHOOL_COOKIE, school.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  store.delete(PERSPECTIVE_COOKIE);
  redirect(APP_HOME_PATH);
}
