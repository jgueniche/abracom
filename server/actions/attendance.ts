"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

/** Opens (or finds) today's occurrence of a list and goes straight to the grid. */
export async function openAttendanceSession(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const listId = field(formData, "listId");
  if (!uuid.test(listId)) return;
  const onDate = optional(formData, "onDate");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_attendance_session", {
    list_: listId,
    on_date_: onDate ?? undefined,
  });
  if (error || !data) throw new Error(error?.message ?? "open_attendance_session failed");
  revalidatePath("/pointage");
  redirect(`/pointage/${data}`);
}

const markSchema = z.object({
  sessionId: z.string().regex(uuid),
  studentId: z.string().regex(uuid),
  status: z.enum(["present", "absent", "late", "excused"]).nullable(),
  at: z.string().datetime().nullable(),
  departure: z.boolean(),
  pickupUserId: z.string().regex(uuid).nullable(),
  pickupNote: z.string().trim().max(200).nullable(),
});

export type MarkInput = z.input<typeof markSchema>;

/**
 * One tap, one call. The offline queue replays exactly this, which is why `at`
 * travels with it: what counts is the moment of the tap, not the moment the
 * network came back.
 */
export async function markAttendance(input: MarkInput): Promise<ActionState> {
  try {
    const t = await getTranslations("attendance");
    await requireCurrentUser();
    const parsed = markSchema.safeParse(input);
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const supabase = await createClient();
    // The undo has its own verb. Sent as `mark_attendance(status_: undefined)`
    // it would fall back on the function's default — 'present' — and the second
    // tap would re-mark the child instead of clearing them.
    const { error } = parsed.data.status
      ? await supabase.rpc("mark_attendance", {
          session_: parsed.data.sessionId,
          student_: parsed.data.studentId,
          status_: parsed.data.status,
          at_: parsed.data.at ?? undefined,
          departure: parsed.data.departure,
          pickup_: parsed.data.pickupUserId ?? undefined,
          pickup_note_: parsed.data.pickupNote ?? undefined,
        })
      : await supabase.rpc("clear_attendance", {
          session_: parsed.data.sessionId,
          student_: parsed.data.studentId,
        });
    if (error) {
      // The pickup guard speaks French already; anything else stays generic.
      return {
        status: "error",
        message: error.code === "42501" ? t("pickupRefused") : t("saveError"),
      };
    }
    revalidatePath(`/pointage/${parsed.data.sessionId}`);
    return { status: "success" };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setAttendanceSessionState(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const sessionId = field(formData, "sessionId");
  if (!uuid.test(sessionId)) return;
  const reopen = formData.get("reopen") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_attendance_session", {
    session_: sessionId,
    reopen,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pointage/${sessionId}`);
  revalidatePath("/pointage");
}
