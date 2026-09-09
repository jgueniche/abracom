"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { NOTIFICATION_GROUPS } from "@/lib/notifications/kinds";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, toActionError } from "./admin/_shared";

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireCurrentUser();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One row per group for channels, plus a `*` row for quiet hours and Shabbat mode. */
export async function saveNotificationPreferences(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("notificationPrefs");
    const user = await requireCurrentUser();
    const quietEnabled = formData.get("quietEnabled") === "on";
    const start = field(formData, "quietStart") || "21:00";
    const end = field(formData, "quietEnd") || "07:00";
    if (quietEnabled && (!TIME.test(start) || !TIME.test(end) || start === end)) {
      return { status: "error", message: t("invalid") };
    }
    const rows: Array<{
      user_id: string;
      kind: string;
      push: boolean;
      email: boolean;
      digest: boolean;
      quiet_hours?: { start: string; end: string };
      shabbat_mode?: boolean;
    }> = NOTIFICATION_GROUPS.map((group) => ({
      user_id: user.id,
      kind: group,
      push: formData.get(`${group}.push`) === "on",
      email: group !== "message" && formData.get(`${group}.email`) === "on",
      digest: formData.get(`${group}.digest`) === "on",
    }));
    rows.push({
      user_id: user.id,
      kind: "*",
      push: true,
      email: true,
      digest: true,
      quiet_hours: quietEnabled ? { start, end } : { start: "00:00", end: "00:00" },
      shabbat_mode: formData.get("shabbatMode") === "on",
    });
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(rows, { onConflict: "user_id,kind" });
    if (error) return { status: "error", message: t("saveError") };
    revalidatePath("/notifications", "layout");
    return { status: "success", message: t("saved") };
  } catch (error) {
    return toActionError(error);
  }
}
