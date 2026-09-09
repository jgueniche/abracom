"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { zonedToUtc } from "@/lib/calendar/dates";
import { EVENT_KINDS, EVENT_SCOPES } from "@/lib/calendar/events";
import { TIME_ZONE } from "@/lib/i18n/config";
import { ForbiddenError, hasSchoolRole, isSchoolStaff } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

const EDITOR_ROLES = ["school_admin", "staff", "teacher"] as const;

function revalidateAgenda(id?: string | null) {
  revalidatePath("/agenda", "layout");
  revalidatePath("/admin/evenements");
  revalidatePath("/accueil");
  if (id) revalidatePath(`/agenda/${id}`);
}

/** French messages raised by the SQL functions (check_violation) are safe to show. */
function dbMessage(error: { code?: string; message: string }, fallback: string): string {
  return error.code === "23514" ? error.message : fallback;
}

// ── RSVP ────────────────────────────────────────────────────────────────────

const rsvpSchema = z.object({
  eventId: z.string().regex(uuid),
  status: z.enum(["yes", "no", "maybe"]),
  guests: z.coerce.number().int().min(0).max(20),
  note: z.string().trim().max(500).nullable(),
  studentId: z.string().regex(uuid).nullable(),
});

export type RsvpState = ActionState & { waitlisted?: boolean };

export async function respondToEvent(_prev: RsvpState, formData: FormData): Promise<RsvpState> {
  try {
    const t = await getTranslations("agenda.rsvp");
    await requireCurrentUser();
    const parsed = rsvpSchema.safeParse({
      eventId: field(formData, "eventId"),
      status: field(formData, "status"),
      guests: field(formData, "guests") || "0",
      note: optional(formData, "note"),
      studentId: optional(formData, "studentId"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: waitlisted, error } = await supabase.rpc("rsvp_event", {
      event: parsed.data.eventId,
      answer: parsed.data.status,
      guests: parsed.data.status === "yes" ? parsed.data.guests : 0,
      note: parsed.data.note ?? undefined,
      student: parsed.data.studentId ?? undefined,
    });
    if (error) {
      return {
        status: "error",
        message: error.code === "42501" ? t("forbidden") : dbMessage(error, t("error")),
      };
    }
    revalidateAgenda(parsed.data.eventId);
    return {
      status: "success",
      message: waitlisted ? t("waitlisted") : t("saved"),
      waitlisted: Boolean(waitlisted),
    };
  } catch (error) {
    return toActionError(error);
  }
}

// ── volunteer slots ─────────────────────────────────────────────────────────

export async function signUpForSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("agenda.slots");
    const user = await requireCurrentUser();
    const slotId = field(formData, "slotId");
    const eventId = field(formData, "eventId");
    const note = optional(formData, "note");
    if (!uuid.test(slotId) || !uuid.test(eventId) || (note && note.length > 200)) {
      return { status: "error", message: t("invalid") };
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("event_slot_signups")
      .insert({ slot_id: slotId, user_id: user.id, note });
    if (error) {
      return {
        status: "error",
        message: error.code === "42501" ? t("forbidden") : dbMessage(error, t("error")),
      };
    }
    revalidateAgenda(eventId);
    return { status: "success", message: t("joined") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelSlotSignup(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const slotId = field(formData, "slotId");
  const eventId = field(formData, "eventId");
  if (!uuid.test(slotId) || !uuid.test(eventId)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_slot_signups")
    .delete()
    .eq("slot_id", slotId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateAgenda(eventId);
}

// ── events (staff and teachers) ─────────────────────────────────────────────

const eventSchema = z.object({
  id: z.string().regex(uuid).nullable(),
  title: z.string().trim().min(1).max(200),
  descriptionMd: z.string().max(20000),
  kind: z.enum(EVENT_KINDS),
  scope: z.enum(EVENT_SCOPES),
  targetIds: z.array(z.string().regex(uuid)),
  allDay: z.boolean(),
  startsAt: z.string().min(10),
  endsAt: z.string().nullable(),
  location: z.string().trim().max(200).nullable(),
  requiresRsvp: z.boolean(),
  capacity: z.coerce.number().int().positive().nullable(),
  rsvpDeadline: z.string().nullable(),
  costNote: z.string().trim().max(300).nullable(),
  notify: z.boolean(),
});

export type EventFormState = ActionState & { id?: string };

function toInstant(value: string | null, allDay: boolean): string | null {
  if (!value) return null;
  const naive = allDay ? value.slice(0, 10) : value;
  const date = zonedToUtc(naive, TIME_ZONE);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function saveEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  try {
    const t = await getTranslations("agenda.form");
    const user = await requireCurrentUser();
    const schoolId = user.school?.id;
    if (!schoolId || !hasSchoolRole(user.roles, schoolId, EDITOR_ROLES)) throw new ForbiddenError();
    const staff = isSchoolStaff(user.roles, schoolId);

    const parsed = eventSchema.safeParse({
      id: optional(formData, "id"),
      title: field(formData, "title"),
      descriptionMd: String(formData.get("descriptionMd") ?? ""),
      kind: field(formData, "kind"),
      scope: field(formData, "audience") || "school",
      targetIds: formData.getAll("targetIds").map(String).filter(Boolean),
      allDay: formData.get("allDay") === "on",
      startsAt: field(formData, "startsAt"),
      endsAt: optional(formData, "endsAt"),
      location: optional(formData, "location"),
      requiresRsvp: formData.get("requiresRsvp") === "on",
      capacity: optional(formData, "capacity"),
      rsvpDeadline: optional(formData, "rsvpDeadline"),
      costNote: optional(formData, "costNote"),
      notify: formData.get("notify") === "on",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const input = parsed.data;
    if (input.scope !== "school" && input.targetIds.length === 0) {
      return { status: "error", message: t("targetsRequired") };
    }
    if (!staff && input.scope !== "class") return { status: "error", message: t("classOnly") };

    const startsAt = toInstant(input.startsAt, input.allDay);
    const endsAt = toInstant(input.endsAt, input.allDay);
    if (!startsAt || (endsAt && endsAt < startsAt)) {
      return { status: "error", message: t("invalidDates") };
    }
    const values = {
      school_id: schoolId,
      scope: input.scope,
      target_ids: input.scope === "school" ? [] : input.targetIds,
      title: input.title,
      description_md: input.descriptionMd,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: input.allDay,
      location: input.location,
      kind: input.kind,
      requires_rsvp: input.requiresRsvp,
      capacity: input.requiresRsvp ? input.capacity : null,
      rsvp_deadline: input.requiresRsvp ? toInstant(input.rsvpDeadline, false) : null,
      cost_note: input.costNote,
    };

    const supabase = await createClient();
    let id = input.id;
    if (id) {
      const { data: updated, error } = await supabase
        .from("events")
        .update(values)
        .eq("id", id)
        .eq("school_id", schoolId)
        .select("id");
      if (error || !updated?.length) return { status: "error", message: t("saveError") };
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert({ ...values, created_by: user.id })
        .select("id")
        .single();
      if (error) return { status: "error", message: t("saveError") };
      id = data.id;
    }

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: input.id ? "event.update" : "event.create",
      entity: "events",
      entityId: id,
      diff: { scope: input.scope, kind: input.kind, startsAt, notify: input.notify },
    });
    if (input.notify) await supabase.rpc("notify_event", { event: id });
    revalidateAgenda(id);
    if (!input.id) redirect(`/agenda/${id}`);
    return { status: "success", message: t("saved"), id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const schoolId = user.school?.id;
  if (!schoolId || !hasSchoolRole(user.roles, schoolId, EDITOR_ROLES)) throw new ForbiddenError();
  const id = field(formData, "id");
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!deleted?.length) return;
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "event.delete",
    entity: "events",
    entityId: id,
    diff: {},
  });
  revalidateAgenda(id);
  redirect("/agenda");
}

const slotSchema = z.object({
  eventId: z.string().regex(uuid),
  label: z.string().trim().min(1).max(120),
  needed: z.coerce.number().int().min(1).max(50),
});

export async function addSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("agenda.form");
    const user = await requireCurrentUser();
    const schoolId = user.school?.id;
    if (!schoolId || !hasSchoolRole(user.roles, schoolId, EDITOR_ROLES)) throw new ForbiddenError();
    const parsed = slotSchema.safeParse({
      eventId: field(formData, "eventId"),
      label: field(formData, "label"),
      needed: field(formData, "needed") || "1",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const supabase = await createClient();
    const { count } = await supabase
      .from("event_slots")
      .select("id", { count: "exact", head: true })
      .eq("event_id", parsed.data.eventId);
    const { error } = await supabase.from("event_slots").insert({
      event_id: parsed.data.eventId,
      label: parsed.data.label,
      needed: parsed.data.needed,
      sort_order: (count ?? 0) + 1,
    });
    if (error) return { status: "error", message: t("saveError") };
    revalidateAgenda(parsed.data.eventId);
    return { status: "success", message: t("slotAdded") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeSlot(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const schoolId = user.school?.id;
  if (!schoolId || !hasSchoolRole(user.roles, schoolId, EDITOR_ROLES)) throw new ForbiddenError();
  const slotId = field(formData, "slotId");
  const eventId = field(formData, "eventId");
  if (!uuid.test(slotId) || !uuid.test(eventId)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("event_slots").delete().eq("id", slotId);
  if (error) throw new Error(error.message);
  revalidateAgenda(eventId);
}

// ── private calendar feed ───────────────────────────────────────────────────

export async function createCalendarFeed(): Promise<void> {
  await requireCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("my_calendar_feed");
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}

export async function rotateCalendarFeed(): Promise<void> {
  await requireCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_calendar_feed");
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}

export async function setFeedHolidays(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("my_calendar_feed", {
    with_holidays: formData.get("includeHolidays") === "on",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}
