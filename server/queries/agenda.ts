import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getMyTeachingClasses } from "@/server/queries/classes";

const EVENT_FIELDS = `
  id, school_id, scope, target_ids, title, description_md, starts_at, ends_at, all_day, location, kind,
  requires_rsvp, capacity, rsvp_deadline, cost_note, created_by, created_at, updated_at,
  creator:profiles!events_created_by_profile_fkey ( first_name, last_name )
` as const;

const EVENT_LIST_SELECT = `${EVENT_FIELDS},
  rsvps:event_rsvps ( user_id, status, guests_count, waitlisted ),
  slots:event_slots ( id, label, needed, sort_order, signups:event_slot_signups ( user_id ) )
` as const;

const EVENT_DETAIL_SELECT = `${EVENT_FIELDS},
  rsvps:event_rsvps ( user_id, status, guests_count, note, waitlisted, student_id ),
  slots:event_slots ( id, label, needed, sort_order,
    signups:event_slot_signups ( user_id, note, created_at,
      profile:profiles!event_slot_signups_user_profile_fkey ( first_name, last_name ) ) )
` as const;

type RsvpRow = {
  user_id: string;
  status: "yes" | "no" | "maybe";
  guests_count: number;
  waitlisted: boolean;
};

/** Adds the caller's own answer (RLS already limits other rows to staff and creators). */
function withMine<T extends { rsvps: RsvpRow[]; slots: Array<{ sort_order: number }> }>(
  row: T,
  userId: string,
) {
  const mine = row.rsvps.find((r) => r.user_id === userId) ?? null;
  const confirmed = row.rsvps.filter((r) => r.status === "yes" && !r.waitlisted);
  return {
    ...row,
    myRsvp: mine,
    visibleCounts: {
      yes: confirmed.length,
      yesSeats: confirmed.reduce((sum, r) => sum + 1 + r.guests_count, 0),
      maybe: row.rsvps.filter((r) => r.status === "maybe").length,
      no: row.rsvps.filter((r) => r.status === "no").length,
      waitlisted: row.rsvps.filter((r) => r.status === "yes" && r.waitlisted).length,
    },
    slots: [...row.slots].sort((a, b) => a.sort_order - b.sort_order),
  };
}

/** Events overlapping [from, to) visible to the signed-in user (RLS), oldest first. */
export async function getAgendaEvents(userId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_LIST_SELECT)
    .is("deleted_at", null)
    .lt("starts_at", to)
    .or(`starts_at.gte.${from},ends_at.gte.${from}`)
    .order("starts_at");
  if (error) throw error;
  return data.map((row) => withMine(row, userId));
}

export type AgendaEvent = Awaited<ReturnType<typeof getAgendaEvents>>[number];

/** The next events from `from` (ISO), for home widgets. */
export async function getUpcomingEvents(userId: string, from: string, limit = 3) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_LIST_SELECT)
    .is("deleted_at", null)
    .neq("kind", "holiday")
    .gte("starts_at", from)
    .order("starts_at")
    .limit(limit);
  if (error) throw error;
  return data.map((row) => withMine(row, userId));
}

export async function getEvent(userId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_DETAIL_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: counts } = await supabase.rpc("event_counts", { event: id }).maybeSingle();
  return {
    ...withMine(data, userId),
    myRsvp: data.rsvps.find((r) => r.user_id === userId) ?? null,
    counts: counts ?? {
      yes_count: 0,
      yes_seats: 0,
      maybe_count: 0,
      no_count: 0,
      waitlisted_count: 0,
      waitlisted_seats: 0,
    },
  };
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEvent>>>;

/** Recipients with their answers (staff and creators only; empty otherwise). */
export async function getEventRecipients(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("event_recipients", { event: id });
  if (error) throw error;
  return data ?? [];
}

export type EventAudienceOptions = {
  staff: boolean;
  levels: Array<{ id: string; code: string; label_fr: string; label_en: string }>;
  classes: Array<{ id: string; name: string }>;
};

/** Audience targets the user may address: the whole school for staff, own classes for teachers. */
export async function getEventAudienceOptions(
  user: CurrentUser,
  schoolId: string,
): Promise<EventAudienceOptions> {
  const supabase = await createClient();
  if (isSchoolStaff(user.roles, schoolId)) {
    const [levels, classes] = await Promise.all([
      supabase
        .from("levels")
        .select("id, code, label_fr, label_en")
        .eq("school_id", schoolId)
        .order("sort_order"),
      supabase
        .from("classes")
        .select("id, name, school_year:school_years!inner ( is_current )")
        .eq("school_id", schoolId)
        .eq("archived", false)
        .eq("school_year.is_current", true)
        .order("name"),
    ]);
    return {
      staff: true,
      levels: levels.data ?? [],
      classes: (classes.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    };
  }
  const teaching = await getMyTeachingClasses(user.id);
  return {
    staff: false,
    levels: [],
    classes: teaching.map((row) => ({ id: row.class!.id, name: row.class!.name })),
  };
}

/** Staff list: every event of the school from a week ago, with visible answers. */
export async function getAdminEvents(userId: string, schoolId: string, from: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_LIST_SELECT)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .gte("starts_at", from)
    .order("starts_at")
    .limit(200);
  if (error) throw error;
  return data.map((row) => withMine(row, userId));
}

export async function getMyCalendarFeed() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_feeds")
    .select("token, include_holidays, rotated_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}
