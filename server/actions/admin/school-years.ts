"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, toActionError, uuid } from "./_shared";

const yearSchema = z
  .object({
    label: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    makeCurrent: z.boolean(),
  })
  .refine((v) => v.endsOn > v.startsOn, { path: ["endsOn"] });

export async function createSchoolYear(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.years");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = yearSchema.safeParse({
      label: field(formData, "label"),
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      makeCurrent: formData.get("makeCurrent") === "on",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("school_years")
      .insert({
        school_id: schoolId,
        label: parsed.data.label,
        starts_on: parsed.data.startsOn,
        ends_on: parsed.data.endsOn,
        is_current: false,
      })
      .select("id")
      .single();
    if (error)
      return { status: "error", message: error.code === "23505" ? t("duplicate") : t("saveError") };

    if (parsed.data.makeCurrent) {
      const { error: rpcError } = await supabase.rpc("set_current_school_year", {
        year_id: data.id,
      });
      if (rpcError) return { status: "error", message: t("saveError") };
    }
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "school_year.create",
      entity: "school_years",
      entityId: data.id,
      diff: { label: parsed.data.label, makeCurrent: parsed.data.makeCurrent },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: t("created") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setCurrentSchoolYear(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const yearId = field(formData, "yearId");
  if (!uuid.test(yearId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_current_school_year", { year_id: yearId });
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "school_year.set_current",
    entity: "school_years",
    entityId: yearId,
  });
  revalidatePath("/admin", "layout");
}
