import "server-only";

import { practiceMode } from "@/lib/ai/config";
import type { CurrentUser } from "@/lib/auth/session";
import { type PracticeLevel, readStoredSheet, type StoredSheet } from "@/lib/practice/schema";
import { signedUrls } from "@/lib/storage-urls";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading practice sheets (ADR-0087), always with the reader's own client: the policies decide
 * who sees a sheet, the same way they decide who sees its homework.
 *
 * Tolerant on purpose. The migration reaches the production database when the branch is merged
 * (« Deploy database »), while a preview deployment already runs this code against it: a
 * missing column or table answers « not offered », never an error page — the homework page
 * must open whatever the state of the database (same rule as ADR-0082).
 */

/** A pending sheet older than this is treated as lost (an instance that died mid-way). */
export const STALE_PENDING_MS = 4 * 60 * 1000;

export type PracticeSheetRow = {
  id: string;
  level: PracticeLevel;
  status: "pending" | "ready" | "failed";
  stage: string | null;
  hidden_at: string | null;
  updated_at: string;
};

export type PracticeState = {
  /** Offered at all: a provider, the school's module, the class's switch. */
  offered: boolean;
  /** The class's own switch, for the team to turn back on. */
  classEnabled: boolean;
  /** False when the database does not know the feature yet. */
  installed: boolean;
  sheets: PracticeSheetRow[];
};

const NOT_INSTALLED: PracticeState = {
  offered: false,
  classEnabled: false,
  installed: false,
  sheets: [],
};

export function schoolAllowsPractice(user: CurrentUser, schoolId: string): boolean {
  const school = user.memberships.find((membership) => membership.school?.id === schoolId)?.school;
  const modules = (school?.modules ?? {}) as Record<string, unknown>;
  return modules.practice !== false;
}

/** The class's switch and the sheets already asked for this homework, in one question. */
export async function getPracticeState(
  user: CurrentUser,
  homework: { id: string; class_id: string; school_id: string },
): Promise<PracticeState> {
  if (!practiceMode()) return NOT_INSTALLED;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("practice_enabled, practice_sheets ( id, level, status, stage, hidden_at, updated_at )")
    .eq("id", homework.class_id)
    .eq("practice_sheets.post_id", homework.id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn("[practice] state:", error.code, error.message);
    return NOT_INSTALLED;
  }
  const schoolEnabled = schoolAllowsPractice(user, homework.school_id);
  return {
    offered: schoolEnabled && data.practice_enabled,
    classEnabled: data.practice_enabled,
    installed: true,
    sheets: data.practice_sheets as PracticeSheetRow[],
  };
}

export type PracticeSheetView = {
  row: PracticeSheetRow & { beta: boolean; model: string | null; created_at: string };
  sheet: StoredSheet | null;
  illustrationUrl: string | null;
  /** clip id → signed URL, for the voices the sheet has. */
  audioUrls: Record<string, string>;
};

/** One sheet as the reader may see it, with its files signed for ten minutes. */
export async function getPracticeSheet(
  postId: string,
  level: PracticeLevel,
): Promise<PracticeSheetView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_sheets")
    .select(
      "id, level, status, stage, hidden_at, updated_at, created_at, beta, model, content, illustration_path",
    )
    .eq("post_id", postId)
    .eq("level", level)
    .maybeSingle();
  if (error) {
    console.warn("[practice] sheet:", error.code, error.message);
    return null;
  }
  if (!data) return null;
  const sheet = data.status === "ready" ? readStoredSheet(data.content) : null;
  const paths = [
    ...(data.illustration_path ? [data.illustration_path] : []),
    ...Object.values(sheet?.audio ?? {}),
  ];
  const urls = paths.length > 0 ? await signedUrls(supabase, "practice", paths) : new Map();
  const audioUrls: Record<string, string> = {};
  for (const [clip, path] of Object.entries(sheet?.audio ?? {})) {
    const url = urls.get(path);
    if (url) audioUrls[clip] = url;
  }
  const { content: _content, illustration_path, ...row } = data;
  return {
    row: row as PracticeSheetView["row"],
    sheet,
    illustrationUrl: illustration_path ? (urls.get(illustration_path) ?? null) : null,
    audioUrls,
  };
}

export function isStalePending(row: { status: string; updated_at: string }, now = Date.now()) {
  return row.status === "pending" && now - new Date(row.updated_at).getTime() > STALE_PENDING_MS;
}

/**
 * The classes, among these, whose homework offers « S'entraîner » — for the diary, which shows
 * the three levels under each homework it unfolds. One question for the whole week, asked beside
 * the homework itself; tolerant like the rest (no provider, no column: an empty set).
 */
export async function getPracticeClassIds(
  user: CurrentUser,
  classIds: readonly string[],
): Promise<Set<string>> {
  if (!practiceMode() || classIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, school_id, practice_enabled")
    .in("id", [...classIds]);
  if (error || !data) {
    if (error) console.warn("[practice] classes:", error.code, error.message);
    return new Set();
  }
  return new Set(
    data
      .filter((cls) => cls.practice_enabled && schoolAllowsPractice(user, cls.school_id))
      .map((cls) => cls.id),
  );
}
