"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { isoWeekday } from "@/lib/calendar/dates";
import { COLUMN_OF, DAY_FIELDS, dayFieldName, MENU_DAYS } from "@/lib/menus";
import { STAFF_ROLES } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, toActionError, uuid } from "./_shared";

const course = z.string().trim().max(120);
const daySchema = z.object({
  day: z.number().int().min(1).max(5),
  starter: course,
  mainCourse: course,
  side: course,
  dessert: course,
  snack: course,
  note: z.string().trim().max(200),
});
const menuSchema = z.object({
  // a week is named by its Monday, and the form only ever sends one
  weekStart: z.iso.date().refine((key) => isoWeekday(key) === 1),
  days: z.array(daySchema).length(MENU_DAYS.length),
});

/** The paths that show a menu: the families' screen, the office screen, the management index. */
function revalidateMenus() {
  revalidatePath("/ecole/menus");
  revalidatePath("/admin/menus");
  revalidatePath("/admin");
}

/**
 * The week and its five days, saved in one transaction by `save_weekly_menu`.
 * Editing a published menu is allowed and is the same call: the database
 * updates the week it already has. The office alone may call it — the
 * secretariat included, as for announcements.
 */
export async function saveWeeklyMenu(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("menus.admin");
    const { user, schoolId } = await assertSchoolContext(STAFF_ROLES);
    const parsed = menuSchema.safeParse({
      weekStart: field(formData, "weekStart"),
      days: MENU_DAYS.map((day) => ({
        day,
        ...Object.fromEntries(
          DAY_FIELDS.map((name) => [name, field(formData, dayFieldName(day, name))]),
        ),
      })),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    // A week with nothing on any day is refused here, in words, before the
    // database refuses it in a code (a note alone is a menu: « pas de cantine »).
    const filled = parsed.data.days.filter((day) => DAY_FIELDS.some((name) => day[name] !== ""));
    if (filled.length === 0) return { status: "error", message: t("emptyWeek") };

    const supabase = await createClient();
    const { data: menuId, error } = await supabase.rpc("save_weekly_menu", {
      school_: schoolId,
      week_start_: parsed.data.weekStart,
      days_: parsed.data.days.map((day) => ({
        day: day.day,
        [COLUMN_OF.starter]: day.starter,
        [COLUMN_OF.mainCourse]: day.mainCourse,
        [COLUMN_OF.side]: day.side,
        [COLUMN_OF.dessert]: day.dessert,
        [COLUMN_OF.snack]: day.snack,
        [COLUMN_OF.note]: day.note,
      })),
    });
    if (error || !menuId)
      return {
        status: "error",
        message: error?.code === "23514" ? t("emptyWeek") : t("saveError"),
      };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "weekly_menu.save",
      entity: "weekly_menus",
      entityId: menuId,
      diff: { weekStart: parsed.data.weekStart, days: filled.map((day) => day.day) },
    });
    revalidateMenus();
    return { status: "success", message: t("saved") };
  } catch (error) {
    return toActionError(error);
  }
}

/** Removes a week entirely — the office typed the wrong one, or the canteen is closed. */
export async function deleteWeeklyMenu(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(STAFF_ROLES);
  const menuId = field(formData, "menuId");
  if (!uuid.test(menuId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_menus")
    .delete()
    .eq("id", menuId)
    .eq("school_id", schoolId)
    .select("week_start")
    .maybeSingle();
  if (data)
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "weekly_menu.delete",
      entity: "weekly_menus",
      entityId: menuId,
      diff: { weekStart: data.week_start },
    });
  revalidateMenus();
}
