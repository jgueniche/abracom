"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

const slotSchema = z
  .object({
    classId: z.string().regex(uuid),
    weekday: z.number().int().min(1).max(7),
    startsAt: z.string().regex(/^\d{2}:\d{2}$/),
    endsAt: z.string().regex(/^\d{2}:\d{2}$/),
    subject: z.string().trim().min(1).max(80),
    teacherId: z.string().regex(uuid).nullable(),
    room: z.string().trim().max(60).nullable(),
  })
  .refine((v) => v.endsAt > v.startsAt, { path: ["endsAt"] });

/** One slot of the weekly grid. RLS decides who may write on which class. */
export async function createTimetableSlot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("timetable");
    const user = await requireCurrentUser();
    const parsed = slotSchema.safeParse({
      classId: field(formData, "classId"),
      weekday: Number(field(formData, "weekday")),
      startsAt: field(formData, "startsAt"),
      endsAt: field(formData, "endsAt"),
      subject: field(formData, "subject"),
      teacherId: optional(formData, "teacherId"),
      room: optional(formData, "room"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: cls } = await supabase
      .from("classes")
      .select("school_id")
      .eq("id", parsed.data.classId)
      .maybeSingle();
    if (!cls) return { status: "error", message: t("saveError") };

    const { error } = await supabase.from("class_timetable").insert({
      school_id: cls.school_id,
      class_id: parsed.data.classId,
      weekday: parsed.data.weekday,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      subject: parsed.data.subject,
      teacher_id: parsed.data.teacherId,
      room: parsed.data.room,
      created_by: user.id,
    });
    if (error) return { status: "error", message: t("saveError") };

    revalidatePath(`/classes/${parsed.data.classId}`, "layout");
    return { status: "success", message: t("saved") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTimetableSlot(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const slotId = field(formData, "slotId");
  const classId = field(formData, "classId");
  if (!uuid.test(slotId) || !uuid.test(classId)) return;
  const supabase = await createClient();
  await supabase.from("class_timetable").delete().eq("id", slotId);
  revalidatePath(`/classes/${classId}`, "layout");
}
