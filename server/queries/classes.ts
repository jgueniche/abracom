import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Classes taught by the signed-in teacher (any role) in the current year. */
export async function getMyTeachingClasses(userId: string) {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  const { data, error } = await supabase
    .from("class_teachers")
    .select(
      `role, subject,
       class:classes ( id, school_id, name, room, archived,
         level:levels ( code, label_fr, label_en, sort_order ),
         school_year:school_years ( label, is_current ),
         enrollments ( count ) )`,
    )
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? [])
    .filter(
      (row) =>
        row.class !== null &&
        !row.class.archived &&
        row.class.school_year?.is_current &&
        // the classes of the school the reader works in (ADR-0074)
        row.class.school_id === user?.school?.id,
    )
    .sort((a, b) => (a.class!.level?.sort_order ?? 0) - (b.class!.level?.sort_order ?? 0));
}

/** Every active class of a school with its head count and teachers (staff view). */
export async function getSchoolClasses(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, name, room,
       level:levels ( code, label_fr, label_en, sort_order ),
       school_year:school_years ( label, is_current ),
       enrollments ( count ),
       class_teachers ( role, subject, profile:profiles ( id, first_name, last_name ) )`,
    )
    .eq("school_id", schoolId)
    .eq("archived", false);
  if (error) throw error;
  return (data ?? [])
    .filter((c) => c.school_year?.is_current)
    .sort((a, b) => (a.level?.sort_order ?? 0) - (b.level?.sort_order ?? 0));
}
