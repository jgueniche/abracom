"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { LOCALE_COOKIE, locales } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d][\d\s.()-]*$/, "phone")
  .or(z.literal(""));

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  locale: z.enum(locales),
  showHebrewDate: z.boolean(),
});

export async function updateProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const t = await getTranslations("profile");
  const user = await requireCurrentUser();

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? "",
    locale: formData.get("locale"),
    showHebrewDate: formData.get("showHebrewDate") === "on",
  });
  if (!parsed.success) return { status: "error", message: t("invalid") };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      locale: parsed.data.locale,
      show_hebrew_date: parsed.data.showHebrewDate,
    })
    .eq("id", user.id);
  if (error) return { status: "error", message: t("saveError") };
  const { error: contactError } = await supabase
    .from("profile_contacts")
    .upsert(
      { user_id: user.id, phone: parsed.data.phone === "" ? null : parsed.data.phone },
      { onConflict: "user_id" },
    );
  if (contactError) return { status: "error", message: t("saveError") };

  (await cookies()).set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { status: "saved", message: t("saved") };
}

/**
 * A member of the team opens or closes their own door to direct messages from
 * families (ADR-0060).
 *
 * The direction already had a tap on the whole school (session 19); this is the
 * one lever a person holds over their own inbox. It never touches colleagues:
 * `can_direct_message` reads it only in its parent branch, and the database is
 * what refuses the message — the screen only says so first.
 */
export async function updateMessagingDoor(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const t = await getTranslations("messaging");
  const user = await requireCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ accepts_parent_dm: formData.get("acceptsParentDm") === "on" })
    .eq("id", user.id);
  if (error) return { status: "error", message: t("doorError") };
  revalidatePath("/profil");
  revalidatePath("/messages", "layout");
  return { status: "saved", message: t("doorSaved") };
}
