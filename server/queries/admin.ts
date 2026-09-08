import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getSchoolYears(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_years")
    .select("id, label, starts_on, ends_on, is_current")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getLevels(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("levels")
    .select("id, code, label_fr, label_en, sort_order")
    .eq("school_id", schoolId)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getAdminClasses(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, name, room, capacity, archived,
       level:levels ( id, code, label_fr, sort_order ),
       school_year:school_years!inner ( id, label, is_current ),
       enrollments ( count ),
       class_teachers ( role, subject, profile:profiles ( id, first_name, last_name ) )`,
    )
    .eq("school_id", schoolId)
    .eq("school_year.is_current", true);
  if (error) throw error;
  return data.sort(
    (a, b) =>
      (a.level?.sort_order ?? 0) - (b.level?.sort_order ?? 0) || a.name.localeCompare(b.name),
  );
}

export async function getClassDetail(schoolId: string, classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, name, room, capacity, archived, level_id,
       level:levels ( code, label_fr ),
       class_teachers ( role, subject, user_id, profile:profiles ( id, first_name, last_name ) ),
       enrollments ( id, joined_on, left_on, student:students ( id, first_name, last_name, birth_date, status ) )`,
    )
    .eq("school_id", schoolId)
    .eq("id", classId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    enrollments: data.enrollments
      .filter((e) => e.left_on === null && e.student)
      .sort((a, b) => a.student!.last_name.localeCompare(b.student!.last_name)),
  };
}

export async function getTeachers(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, status, profile:profiles ( id, first_name, last_name )")
    .eq("school_id", schoolId)
    .eq("role", "teacher");
  if (error) throw error;
  return data
    .filter((m) => m.profile)
    .sort((a, b) => a.profile!.last_name.localeCompare(b.profile!.last_name));
}

export async function searchStudents(schoolId: string, query: string) {
  const supabase = await createClient();
  let request = supabase
    .from("students")
    .select(
      `id, first_name, last_name, birth_date, status,
       enrollments ( left_on, class:classes ( id, name ) ),
       student_guardians ( relation, is_primary, access_blocked, profile:profiles ( id, first_name, last_name ) )`,
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("last_name")
    .order("first_name")
    .limit(200);
  const q = query.trim();
  if (q)
    request = request.or(`first_name.ilike.%${escapeLike(q)}%,last_name.ilike.%${escapeLike(q)}%`);
  const { data, error } = await request;
  if (error) throw error;
  return data.map((s) => ({
    ...s,
    currentClass: s.enrollments.find((e) => e.left_on === null)?.class ?? null,
  }));
}

function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, "");
}

export async function getStudentDetail(schoolId: string, studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      `id, first_name, last_name, birth_date, allergies_note, status, image_rights_signed_at,
       family:families ( id, name ),
       enrollments ( id, joined_on, left_on, class:classes ( id, name, school_year:school_years ( label, is_current ) ) ),
       student_guardians ( user_id, relation, is_primary, can_view_grades, can_message, receives_notifications, access_blocked, access_blocked_reason,
         profile:profiles ( id, first_name, last_name, phone, locale ) )`,
    )
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const guardianIds = data.student_guardians.map((g) => g.user_id);
  const { data: memberships } = guardianIds.length
    ? await supabase
        .from("memberships")
        .select("id, user_id, role, status, invited_at")
        .eq("school_id", schoolId)
        .in("user_id", guardianIds)
        .in("role", ["parent", "guardian"])
    : { data: [] };

  return {
    ...data,
    currentEnrollment:
      data.enrollments.find((e) => e.left_on === null && e.class?.school_year?.is_current) ?? null,
    guardians: data.student_guardians.map((g) => ({
      ...g,
      membership: (memberships ?? []).find((m) => m.user_id === g.user_id) ?? null,
    })),
  };
}

export async function getMembers(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, user_id, role, status, invited_at, accepted_at, created_at, profile:profiles ( id, first_name, last_name, phone )",
    )
    .eq("school_id", schoolId)
    .order("created_at");
  if (error) throw error;
  const team = data.filter((m) =>
    ["super_admin", "school_admin", "staff", "teacher"].includes(m.role),
  );
  const parents = data.filter((m) => m.role === "parent" || m.role === "guardian");
  const pending = parents.filter((m) => m.status === "invited" && m.invited_at === null).length;
  return { team, parents, pending };
}

export async function getAuditLog(schoolId: string, limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, action, entity, entity_id, diff, created_at, actor:profiles ( first_name, last_name )",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
