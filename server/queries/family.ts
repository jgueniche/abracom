import "server-only";

import { createClient } from "@/lib/supabase/server";

const CHILD_SELECT = `
  relation, is_primary, can_view_grades, can_message,
  student:students (
    id, first_name, last_name, birth_date, photo_path, allergies_note, image_rights_signed_at, status,
    enrollments (
      id, joined_on, left_on,
      class:classes (
        id, name, room,
        level:levels ( code, label_fr, label_en ),
        class_teachers ( role, subject, profile:profiles ( id, first_name, last_name, avatar_path ) )
      )
    )
  )
` as const;

/** The signed-in guardian's children with their current class and teachers (RLS-scoped). */
export async function getMyChildren() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_guardians")
    .select(CHILD_SELECT)
    .order("is_primary", { ascending: false });
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  return (data ?? [])
    .filter((row) => row.student !== null)
    .map((row) => ({
      ...row,
      student: {
        ...row.student!,
        // The database allows a single open enrolment per pupil (ADR-0034), but
        // a class change closes the old one on the day it opens the new, and
        // both pass this filter for a day. The open one comes first so the
        // screens that read a single enrolment always read the current class.
        enrollments: row
          .student!.enrollments.filter((e) => e.left_on === null || e.left_on >= today)
          .sort((a, b) => (a.left_on === null ? 0 : 1) - (b.left_on === null ? 0 : 1)),
      },
    }));
}

export type ChildWithClass = Awaited<ReturnType<typeof getMyChildren>>[number];
