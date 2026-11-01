"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, toActionError, uuid } from "./admin/_shared";

/**
 * What the team of a class does with the practice sheets of its homework (ADR-0087): withdraw
 * one, throw one away to have it prepared again, close or reopen the feature for the class.
 *
 * Each goes through a `security definer` function that checks the right (teacher of the class
 * or school staff) and writes the audit log — the policies alone would let nobody update a
 * sheet, by design. Kept apart from the request so that the homework page, which offers the
 * class switch, does not carry the preparation job (ADR-0066).
 */

export async function setPracticeSheetHidden(
  sheetId: string,
  hidden: boolean,
  postId: string,
): Promise<ActionState> {
  try {
    await requireCurrentUser();
    if (!uuid.test(sheetId) || !uuid.test(postId)) return { status: "error" };
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_practice_sheet_hidden", {
      p_sheet: sheetId,
      p_hidden: hidden,
    });
    if (error) throw error;
    revalidatePath(`/devoirs/${postId}`, "layout");
    return { status: "success" };
  } catch (error) {
    return toActionError(error);
  }
}

export async function discardPracticeSheet(sheetId: string, postId: string): Promise<ActionState> {
  try {
    await requireCurrentUser();
    if (!uuid.test(sheetId) || !uuid.test(postId)) return { status: "error" };
    const supabase = await createClient();
    // Where its files live, read before the row goes (the team reads it under the policies).
    const { data: sheet } = await supabase
      .from("practice_sheets")
      .select("school_id, class_id")
      .eq("id", sheetId)
      .maybeSingle();
    const { error } = await supabase.rpc("discard_practice_sheet", { p_sheet: sheetId });
    if (error) throw error;
    if (sheet) await removeFolder(`${sheet.school_id}/${sheet.class_id}/${sheetId}`);
    revalidatePath(`/devoirs/${postId}`, "layout");
    return { status: "success" };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setClassPractice(
  classId: string,
  enabled: boolean,
  postId: string,
): Promise<ActionState> {
  try {
    await requireCurrentUser();
    if (!uuid.test(classId) || !uuid.test(postId)) return { status: "error" };
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_class_practice", {
      p_class: classId,
      p_enabled: enabled,
    });
    if (error) throw error;
    revalidatePath(`/devoirs/${postId}`, "layout");
    return { status: "success" };
  } catch (error) {
    return toActionError(error);
  }
}

/** The right was checked by the function that just ran; the files follow their row. */
async function removeFolder(folder: string) {
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage.from("practice").list(folder, { limit: 100 });
    const paths = (data ?? []).map((file) => `${folder}/${file.name}`);
    if (paths.length > 0) await admin.storage.from("practice").remove(paths);
  } catch (error) {
    console.warn("[practice] remove files:", (error as Error).message);
  }
}
