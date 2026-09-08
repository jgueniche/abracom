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
      phone: parsed.data.phone === "" ? null : parsed.data.phone,
      locale: parsed.data.locale,
      show_hebrew_date: parsed.data.showHebrewDate,
    })
    .eq("id", user.id);
  if (error) return { status: "error", message: t("saveError") };

  (await cookies()).set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { status: "saved", message: t("saved") };
}
