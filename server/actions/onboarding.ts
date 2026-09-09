"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getLegalStatus } from "@/lib/auth/legal";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { LOCALE_COOKIE, locales } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = {
  status: "idle" | "error";
  message?: string;
};

const onboardingSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  locale: z.enum(locales),
  accepted: z.array(z.uuid()),
  join: z.array(z.uuid()),
});

/** First login: name, language and timestamped acceptance of the current legal texts. */
export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const t = await getTranslations("auth.onboarding");
  const user = await requireCurrentUser();

  const parsed = onboardingSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    locale: formData.get("locale"),
    accepted: formData.getAll("accept").map(String),
    join: formData.getAll("join").map(String),
  });
  if (!parsed.success) return { status: "error", message: t("required") };

  const legal = await getLegalStatus(user);
  const missing = legal.documents.filter((d) => !d.accepted);
  const accepted = new Set(parsed.data.accepted);
  if (missing.some((d) => !accepted.has(d.id))) {
    return { status: "error", message: t("mustAccept") };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      locale: parsed.data.locale,
    })
    .eq("id", user.id);
  if (error) return { status: "error", message: t("saveError") };

  if (missing.length > 0) {
    const { error: acceptError } = await supabase
      .from("legal_acceptances")
      .insert(missing.map((d) => ({ user_id: user.id, legal_document_id: d.id })));
    if (acceptError) return { status: "error", message: t("saveError") };
  }

  // only the invitations ticked on the form become active memberships (explicit consent)
  const invited = user.memberships.filter((m) => m.status === "invited").map((m) => m.school_id);
  const schools = invited.filter((id) => parsed.data.join.includes(id));
  if (invited.length > 0 && schools.length === 0) {
    return { status: "error", message: t("mustJoin") };
  }
  const { error: activateError } = await supabase.rpc("activate_my_memberships", { schools });
  if (activateError) return { status: "error", message: t("saveError") };

  (await cookies()).set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  redirect(APP_HOME_PATH);
}
