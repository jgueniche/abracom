"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { assertSchoolContext } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, toActionError, uuid } from "./_shared";

export type PromotionState = ActionState & {
  result?: { classes: number; students: number; left: number };
};

/**
 * Level promotion wizard: `target:<classId>` = level id or "leave", `name:<classId>` = new class name.
 * The SQL function does everything in one transaction and writes the audit log.
 */
export async function promoteSchoolYear(
  _prev: PromotionState,
  formData: FormData,
): Promise<PromotionState> {
  try {
    const t = await getTranslations("admin.promotion");
    const { schoolId } = await assertSchoolContext(["school_admin"]);
    const currentYear = field(formData, "currentYear");
    const nextYear = field(formData, "nextYear");
    if (!uuid.test(currentYear) || !uuid.test(nextYear) || currentYear === nextYear) {
      return { status: "error", message: t("invalid") };
    }
    if (field(formData, "confirm") !== "on")
      return { status: "error", message: t("confirmRequired") };
    const mapping: Array<{
      class_id: string;
      target_level_id: string | null;
      name: string | null;
    }> = [];
    for (const [key, raw] of formData.entries()) {
      if (!key.startsWith("target:")) continue;
      const classId = key.slice("target:".length);
      const target = String(raw);
      if (!uuid.test(classId) || (target !== "leave" && !uuid.test(target))) {
        return { status: "error", message: t("invalid") };
      }
      const name = field(formData, `name:${classId}`).slice(0, 80);
      mapping.push({
        class_id: classId,
        target_level_id: target === "leave" ? null : target,
        name: name || null,
      });
    }
    if (mapping.length === 0) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { count } = await supabase
      .from("school_years")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("id", [currentYear, nextYear]);
    if (count !== 2) return { status: "error", message: t("invalid") };

    const { data, error } = await supabase.rpc("promote_school_year", {
      current_year: currentYear,
      next_year: nextYear,
      mapping,
    });
    if (error) {
      return {
        status: "error",
        message:
          error.code === "23514"
            ? error.message
            : error.code === "42501"
              ? t("forbidden")
              : t("error"),
      };
    }
    const result = (data ?? {}) as { classes?: number; students?: number; left?: number };
    revalidatePath("/admin", "layout");
    revalidatePath("/classes", "layout");
    revalidatePath("/famille");
    return {
      status: "success",
      message: t("done", {
        classes: result.classes ?? 0,
        students: result.students ?? 0,
        left: result.left ?? 0,
      }),
      result: {
        classes: result.classes ?? 0,
        students: result.students ?? 0,
        left: result.left ?? 0,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}
