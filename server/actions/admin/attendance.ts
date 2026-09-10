"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./_shared";

const listSchema = z.object({
  kind: z.enum(["class_roll", "service", "occasional"]),
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{2,40}$/)
    .nullable(),
  classId: z.string().regex(uuid).nullable(),
  classIds: z.array(z.string().regex(uuid)),
  weekdays: z.array(z.number().int().min(1).max(7)),
  startsOn: z.iso.date().nullable(),
  endsOn: z.iso.date().nullable(),
  recordsPickup: z.boolean(),
  visibleToGuardians: z.boolean(),
});

/** A recurring list: the roll call of a class, or a service (after-school, canteen). */
export async function createAttendanceList(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.attendance");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const kind = field(formData, "kind");
    const parsed = listSchema.safeParse({
      kind,
      name: field(formData, "name"),
      code: optional(formData, "code"),
      classId: kind === "service" ? null : optional(formData, "classId"),
      classIds: kind === "service" ? formData.getAll("classIds").map(String) : [],
      weekdays: formData.getAll("weekdays").map((d) => Number(d)),
      startsOn: optional(formData, "startsOn"),
      endsOn: optional(formData, "endsOn"),
      // Arbitrage 6: the roll call stays at one tap per child.
      recordsPickup: kind !== "class_roll",
      // Arbitrage 5: families follow services and outings, never the roll call.
      visibleToGuardians: kind !== "class_roll",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("attendance_lists")
      .insert({
        school_id: schoolId,
        kind: parsed.data.kind,
        name: parsed.data.name,
        code: parsed.data.code,
        class_id: parsed.data.classId,
        class_ids: parsed.data.classIds,
        weekdays: parsed.data.weekdays,
        starts_on: parsed.data.startsOn,
        ends_on: parsed.data.endsOn,
        records_pickup: parsed.data.recordsPickup,
        visible_to_guardians: parsed.data.visibleToGuardians,
        created_by: user.id,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "attendance.list.create",
      entity: "attendance_lists",
      entityId: data.id,
      diff: { kind: parsed.data.kind, name: parsed.data.name },
    });
    revalidatePath("/admin/pointage");
    revalidatePath("/pointage");
    return { status: "success", message: t("listCreated") };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * "Créer la liste de pointage de cette sortie", from the event itself: the
 * outing's target classes become the roster, and the person lands on the grid.
 */
export async function createOutingAttendanceList(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff", "teacher"]);
  const eventId = field(formData, "eventId");
  if (!uuid.test(eventId)) return;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, scope, target_ids, starts_at")
    .eq("id", eventId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!event) return;

  const existing = await supabase
    .from("attendance_lists")
    .select("id")
    .eq("event_id", eventId)
    .eq("archived", false)
    .maybeSingle();
  if (existing.data) redirect(`/admin/pointage?liste=${existing.data.id}`);

  const classIds = event.scope === "class" ? (event.target_ids ?? []) : [];
  const { data, error } = await supabase
    .from("attendance_lists")
    .insert({
      school_id: schoolId,
      kind: "occasional",
      name: event.title.slice(0, 120),
      class_id: classIds.length === 1 ? classIds[0]! : null,
      class_ids: classIds.length > 1 ? classIds : [],
      event_id: eventId,
      records_pickup: true,
      visible_to_guardians: true,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "list insert failed");

  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "attendance.list.create",
    entity: "attendance_lists",
    entityId: data.id,
    diff: { from_event: eventId },
  });
  const { data: sessionId } = await supabase.rpc("open_attendance_session", {
    list_: data.id,
    on_date_: event.starts_at.slice(0, 10),
  });
  revalidatePath(`/agenda/${eventId}`);
  revalidatePath("/pointage");
  redirect(sessionId ? `/pointage/${sessionId}` : "/pointage");
}

export async function setAttendanceListManager(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const listId = field(formData, "listId");
  const userId = field(formData, "userId");
  if (!uuid.test(listId) || !uuid.test(userId)) return;
  const remove = formData.get("remove") === "true";
  const supabase = await createClient();
  if (remove) {
    await supabase
      .from("attendance_list_managers")
      .delete()
      .eq("list_id", listId)
      .eq("user_id", userId);
  } else {
    await supabase
      .from("attendance_list_managers")
      .upsert({ list_id: listId, user_id: userId, added_by: user.id });
  }
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: remove ? "attendance.manager.remove" : "attendance.manager.add",
    entity: "attendance_lists",
    entityId: listId,
    diff: { user: userId },
  });
  revalidatePath("/admin/pointage");
}

export async function archiveAttendanceList(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const listId = field(formData, "listId");
  if (!uuid.test(listId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_lists")
    .update({ archived: true })
    .eq("id", listId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (data)
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "attendance.list.archive",
      entity: "attendance_lists",
      entityId: listId,
    });
  revalidatePath("/admin/pointage");
  revalidatePath("/pointage");
}
