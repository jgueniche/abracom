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
        enrollments: row.student!.enrollments.filter(
          (e) => e.left_on === null || e.left_on >= today,
        ),
      },
    }));
}

export type ChildWithClass = Awaited<ReturnType<typeof getMyChildren>>[number];
