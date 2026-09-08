import "server-only";

import { parseFormSchema } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export const COMMUNITY_CATEGORIES = [
  "carpool",
  "childcare",
  "lost_found",
  "marketplace",
  "recommendation",
  "other",
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

// ── directory ────────────────────────────────────────────────────────────────

export async function getMyDirectorySettings(userId: string, schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("directory_optins")
    .select(
      "show_phone, show_email, show_children_names, show_address, address, show_birthday, show_on_classifieds",
    )
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getClassDirectory(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("class_directory", { class_: classId });
  if (error) throw error;
  return data ?? [];
}

export async function getClassBirthdays(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("class_birthdays", { class_: classId });
  if (error) throw error;
  return data ?? [];
}

// ── classifieds ──────────────────────────────────────────────────────────────

const CLASSIFIED_SELECT = `
  id, category, title, body, status, expires_at, created_at, updated_at, author_id, moderated_at,
  author:profiles!community_posts_author_profile_fkey ( first_name, last_name )
` as const;

/** Published classifieds (RLS also returns the caller's own drafts and the staff's full view). */
export async function getClassifieds(options: { category?: CommunityCategory | null } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("community_posts")
    .select(CLASSIFIED_SELECT)
    .eq("status", "published")
    .is("deleted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  if (options.category) query = query.eq("category", options.category);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getMyClassifieds(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_posts")
    .select(CLASSIFIED_SELECT)
    .eq("author_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getClassified(id: string) {
  const supabase = await createClient();
  const [{ data, error }, contact] = await Promise.all([
    supabase.from("community_posts").select(CLASSIFIED_SELECT).eq("id", id).maybeSingle(),
    supabase.rpc("classified_contact", { post: id }).maybeSingle(),
  ]);
  if (error) throw error;
  return data ? { ...data, contact: contact.data ?? null } : null;
}

/** Staff: every classified of the school, pending first. */
export async function getAdminClassifieds(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_posts")
    .select(CLASSIFIED_SELECT)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const order = { pending: 0, published: 1, archived: 2, rejected: 3 } as const;
  return (data ?? []).sort((a, b) => order[a.status] - order[b.status]);
}

// ── appointments ─────────────────────────────────────────────────────────────

/** Slots of a class as seen by a family: bookings of other families are anonymous. */
export async function getAppointmentSlots(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointment_slots")
    .select("id, starts_at, ends_at, location, booked_by, student_id, booked_at, teacher_id")
    .eq("class_id", classId)
    .order("starts_at");
  if (error) throw error;
  return data ?? [];
}

/** Slots with family names (teacher of the class and staff). */
export async function getClassAppointments(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("class_appointments", { class_: classId });
  if (error) throw error;
  return data ?? [];
}

// ── forms ────────────────────────────────────────────────────────────────────

export { FORM_FIELD_TYPES, type FormField, type FormFieldType, parseFormSchema } from "@/lib/forms";

const FORM_SELECT = `
  id, title, description_md, schema, audience, target_ids, per_student, opens_at, closes_at,
  created_at, created_by, notified_at,
  responses:form_responses ( id, user_id, student_id, submitted_at )
` as const;

/** Open forms addressed to the caller (RLS), with the caller's own responses embedded. */
export async function getForms() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select(FORM_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((form) => ({ ...form, fields: parseFormSchema(form.schema) }));
}

export type FormSummary = Awaited<ReturnType<typeof getForms>>[number];

export async function getForm(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select(FORM_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, fields: parseFormSchema(data.schema) } : null;
}

export async function getMyFormResponses(formId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_responses")
    .select("id, student_id, answers, submitted_at")
    .eq("form_id", formId)
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

/** Staff: every response with the respondent and child names. */
export async function getFormResponses(formId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_responses")
    .select(
      `id, user_id, student_id, answers, submitted_at,
       user:profiles!form_responses_user_profile_fkey ( first_name, last_name ),
       student:students ( first_name, last_name )`,
    )
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function formStatus(
  form: { opens_at: string | null; closes_at: string | null },
  now = Date.now(),
): "scheduled" | "open" | "closed" {
  if (form.opens_at && new Date(form.opens_at).getTime() > now) return "scheduled";
  if (form.closes_at && new Date(form.closes_at).getTime() <= now) return "closed";
  return "open";
}
