"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./_shared";

const classSchema = z.object({
  name: z.string().trim().min(1).max(80),
  levelId: z.string().regex(uuid),
  room: z.string().trim().max(40).nullable(),
  capacity: z.coerce.number().int().min(1).max(60).nullable(),
});

export async function createClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.classes");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = classSchema.safeParse({
      name: field(formData, "name"),
      levelId: field(formData, "levelId"),
      room: optional(formData, "room"),
      capacity: optional(formData, "capacity"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: year } = await supabase
      .from("school_years")
      .select("id")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle();
    if (!year) return { status: "error", message: t("noCurrentYear") };

    const { data, error } = await supabase
      .from("classes")
      .insert({
        school_id: schoolId,
        school_year_id: year.id,
        level_id: parsed.data.levelId,
        name: parsed.data.name,
        room: parsed.data.room,
        capacity: parsed.data.capacity,
      })
      .select("id")
      .single();
    if (error)
      return { status: "error", message: error.code === "23505" ? t("duplicate") : t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "class.create",
      entity: "classes",
      entityId: data.id,
      diff: { name: parsed.data.name },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: t("created") };
  } catch (error) {
    return toActionError(error);
  }
}

const updateSchema = classSchema.extend({
  classId: z.string().regex(uuid),
  archived: z.boolean(),
});

export async function updateClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.classes");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = updateSchema.safeParse({
      classId: field(formData, "classId"),
      name: field(formData, "name"),
      levelId: field(formData, "levelId"),
      room: optional(formData, "room"),
      capacity: optional(formData, "capacity"),
      archived: formData.get("archived") === "on",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { error } = await supabase
      .from("classes")
      .update({
        name: parsed.data.name,
        level_id: parsed.data.levelId,
        room: parsed.data.room,
        capacity: parsed.data.capacity,
        archived: parsed.data.archived,
      })
      .eq("id", parsed.data.classId)
      .eq("school_id", schoolId);
    if (error) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "class.update",
      entity: "classes",
      entityId: parsed.data.classId,
      diff: { name: parsed.data.name, archived: parsed.data.archived },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: t("saved") };
  } catch (error) {
    return toActionError(error);
  }
}

const teacherSchema = z.object({
  classId: z.string().regex(uuid),
  userId: z.string().regex(uuid),
  role: z.enum(["main", "assistant", "specialist"]),
  subject: z.string().trim().max(60).nullable(),
});

export async function assignTeacher(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.classes");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = teacherSchema.safeParse({
      classId: field(formData, "classId"),
      userId: field(formData, "userId"),
      role: field(formData, "role"),
      subject: optional(formData, "subject"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { error } = await supabase.from("class_teachers").upsert(
      {
        class_id: parsed.data.classId,
        user_id: parsed.data.userId,
        role: parsed.data.role,
        subject: parsed.data.subject,
      },
      { onConflict: "class_id,user_id" },
    );
    if (error) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "class.assign_teacher",
      entity: "class_teachers",
      entityId: parsed.data.classId,
      diff: { userId: parsed.data.userId, role: parsed.data.role },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: t("teacherAssigned") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeTeacher(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const classId = field(formData, "classId");
  const userId = field(formData, "userId");
  if (!uuid.test(classId) || !uuid.test(userId)) return;
  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("class_teachers")
    .delete()
    .eq("class_id", classId)
    .eq("user_id", userId)
    .select("class_id");
  if (error) throw new Error(error.message);
  if (!removed?.length) return;
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "class.remove_teacher",
    entity: "class_teachers",
    entityId: classId,
    diff: { userId },
  });
  revalidatePath("/admin", "layout");
}
