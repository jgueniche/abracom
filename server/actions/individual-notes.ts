"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, toActionError, uuid } from "./admin/_shared";

const noteSchema = z.object({
  studentId: z.string().regex(uuid),
  classId: z.string().regex(uuid).nullable(),
  bodyMd: z.string().trim().min(1).max(5000),
  kind: z.enum(["praise", "concern", "info"]),
  visibility: z.enum(["parents", "staff"]),
});

/** "Mot individuel": a private note from the teacher to the guardians of one student. */
export async function createIndividualNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("classSpace.notes");
    const user = await requireCurrentUser();
    const parsed = noteSchema.safeParse({
      studentId: field(formData, "studentId"),
      classId: field(formData, "classId") || null,
      bodyMd: String(formData.get("bodyMd") ?? ""),
      kind: field(formData, "kind") || "info",
      visibility: field(formData, "visibility") || "parents",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: student } = await supabase
      .from("students")
      .select("school_id")
      .eq("id", parsed.data.studentId)
      .maybeSingle();
    if (!student) return { status: "error", message: t("saveError") };
    const { error } = await supabase.from("individual_notes").insert({
      school_id: student.school_id,
      student_id: parsed.data.studentId,
      author_id: user.id,
      body_md: parsed.data.bodyMd,
      kind: parsed.data.kind,
      visibility: parsed.data.visibility,
    });
    if (error) return { status: "error", message: t("saveError") };

    if (parsed.data.classId) revalidatePath(`/classes/${parsed.data.classId}`, "layout");
    revalidatePath("/famille");
    return { status: "success", message: t("sent") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markNoteRead(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const noteId = field(formData, "noteId");
  if (!uuid.test(noteId)) return;
  const supabase = await createClient();
  await supabase
    .from("individual_note_reads")
    .upsert(
      { note_id: noteId, user_id: user.id },
      { onConflict: "note_id,user_id", ignoreDuplicates: true },
    );
  revalidatePath("/famille");
  const classId = field(formData, "classId");
  if (uuid.test(classId)) revalidatePath(`/classes/${classId}`, "layout");
}

/**
 * "Bravo" in one tap (chantier C).
 *
 * Praise already existed as a `kind` of individual note, but it was buried
 * behind a pupil selector, a nature selector and a visibility selector — four
 * decisions to say well done, which is why nobody said it. The button carries
 * the exact sentence it sends, so nothing is written in the teacher's name that
 * they have not read on the button itself.
 */
export async function sendPraise(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const studentId = field(formData, "studentId");
  const classId = field(formData, "classId");
  if (!uuid.test(studentId)) return;
  const t = await getTranslations("classSpace.notes");
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("school_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return;
  // RLS decides whether this author may write to this pupil.
  await supabase.from("individual_notes").insert({
    school_id: student.school_id,
    student_id: studentId,
    author_id: user.id,
    body_md: t("praiseBody"),
    kind: "praise",
    visibility: "parents",
  });
  if (uuid.test(classId)) revalidatePath(`/classes/${classId}`, "layout");
  revalidatePath("/famille");
}
