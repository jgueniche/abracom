"use server";

import { after } from "next/server";
import { getTranslations } from "next-intl/server";

import { practiceMode } from "@/lib/ai/config";
import { requireCurrentUser } from "@/lib/auth/session";
import { PRACTICE_LEVELS, type PracticeLevel } from "@/lib/practice/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareSheet } from "@/server/jobs/practice-sheet";
import { getHomework } from "@/server/queries/class-space";
import { getPracticeState, isStalePending } from "@/server/queries/practice";

import { uuid } from "./admin/_shared";

/**
 * « S'entraîner » — a family asks for a practice sheet (ADR-0087).
 *
 * Kept in its own file because it is the only practice action that reaches the job, and the
 * job carries `sharp` and the Google SDK: a Server Action is bundled into every route that
 * imports it, and the homework page, which only links here, must not carry either (ADR-0066).
 *
 * The reader's right is proved the way the page proves it: `getHomework` reads through the
 * reader's own policies, so a homework they cannot see answers « not found ». Only then is the
 * row claimed with the service key — no family can write a sheet itself (ADR-0087) — and the
 * preparation runs after the answer (`after`), so leaving the page does not stop it. The page
 * polls the row and shows each stage as the job writes it.
 */

/** Sheets one person may have prepared in 24 hours, and one school. */
const PER_USER_DAY = 20;
const PER_SCHOOL_DAY = 300;

export type PracticeRequestState = { status: "ok" } | { status: "error"; message: string };

export async function requestPracticeSheet(
  postId: string,
  level: PracticeLevel,
): Promise<PracticeRequestState> {
  const t = await getTranslations("practice.errors");
  const fail = (message: string): PracticeRequestState => ({ status: "error", message });
  try {
    const user = await requireCurrentUser();
    if (!uuid.test(postId) || !PRACTICE_LEVELS.includes(level)) return fail(t("invalid"));
    if (!practiceMode()) return fail(t("unavailable"));

    const homework = await getHomework(postId);
    if (!homework || !homework.due_on || !homework.published_at) return fail(t("notFound"));
    const state = await getPracticeState(user, homework);
    if (!state.offered) return fail(t("closed"));

    const admin = createAdminClient();
    const { data: row, error: readError } = await admin
      .from("practice_sheets")
      .select("id, status, updated_at, hidden_at")
      .eq("post_id", postId)
      .eq("level", level)
      .maybeSingle();
    if (readError) throw readError;
    if (row?.hidden_at) return fail(t("hidden"));
    if (row && (row.status === "ready" || (row.status === "pending" && !isStalePending(row)))) {
      return { status: "ok" };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [mine, school] = await Promise.all([
      admin
        .from("practice_sheets")
        .select("id", { count: "exact", head: true })
        .eq("requested_by", user.id)
        .gte("created_at", since),
      admin
        .from("practice_sheets")
        .select("id", { count: "exact", head: true })
        .eq("school_id", homework.school_id)
        .gte("created_at", since),
    ]);
    if ((mine.count ?? 0) >= PER_USER_DAY) return fail(t("quotaUser"));
    if ((school.count ?? 0) >= PER_SCHOOL_DAY) return fail(t("quotaSchool"));

    let sheetId: string;
    if (row) {
      // A sheet that failed, or whose preparation was lost: asked again, counted again.
      const { error } = await admin
        .from("practice_sheets")
        .update({
          status: "pending",
          stage: null,
          error: null,
          requested_by: user.id,
          created_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .in("status", ["failed", "pending"]);
      if (error) throw error;
      sheetId = row.id;
    } else {
      const { data, error } = await admin
        .from("practice_sheets")
        .insert({
          post_id: postId,
          level,
          school_id: homework.school_id,
          class_id: homework.class_id,
          requested_by: user.id,
        })
        .select("id")
        .single();
      // Another family of the class asked at the same instant: theirs is being prepared.
      if (error?.code === "23505") return { status: "ok" };
      if (error) throw error;
      sheetId = data.id;
    }

    after(() => prepareSheet(sheetId));
    return { status: "ok" };
  } catch (error) {
    console.error("[practice] request:", (error as Error).message);
    return fail(t("unexpected"));
  }
}
