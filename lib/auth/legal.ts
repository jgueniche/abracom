import "server-only";

import { type CurrentUser, getCurrentUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export const LEGAL_KINDS = ["terms", "charter", "privacy"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export type LegalStatus = {
  /** Latest version of each kind (school-specific first, then platform-wide). */
  documents: Array<Tables<"legal_documents"> & { accepted: boolean }>;
  missing: LegalKind[];
};

export type LegalRows = {
  documents: Tables<"legal_documents">[];
  accepted: Set<string>;
};

/**
 * The legal texts and what this reader has already signed — fetched without
 * knowing anything about them beyond their identifier.
 *
 * It used to take the `CurrentUser`, which meant waiting for the profile, the
 * contacts and the memberships before the first of these two queries could even
 * start: a second round trip to Supabase on every page of the application. The
 * table holds three rows and its select policy is `using (true)`, so the
 * narrowing by school and by locale is done below, once, in TypeScript
 * (ADR-0061). The acceptances are still narrowed in SQL, because a member of
 * the staff may read other people's.
 */
export async function fetchLegalRows(): Promise<LegalRows> {
  const [supabase, userId] = await Promise.all([createClient(), getCurrentUserId()]);
  if (!userId) return { documents: [], accepted: new Set() };
  const [{ data: documents }, { data: acceptances }] = await Promise.all([
    supabase.from("legal_documents").select("*").order("published_at", { ascending: false }),
    supabase.from("legal_acceptances").select("legal_document_id").eq("user_id", userId),
  ]);
  return {
    documents: documents ?? [],
    accepted: new Set((acceptances ?? []).map((a) => a.legal_document_id)),
  };
}

/** Which legal texts the user still has to accept (versioned, timestamped acceptances). */
export function buildLegalStatus(user: CurrentUser, rows: LegalRows): LegalStatus {
  const schoolIds = new Set(user.memberships.map((m) => m.school_id));
  const mine = rows.documents.filter(
    (d) => d.locale === user.profile.locale && (d.school_id === null || schoolIds.has(d.school_id)),
  );

  const latest = new Map<LegalKind, Tables<"legal_documents">>();
  for (const kind of LEGAL_KINDS) {
    const candidates = mine.filter((d) => d.kind === kind);
    const pick = candidates.find((d) => d.school_id !== null) ?? candidates[0];
    if (pick) latest.set(kind, pick);
  }

  const withStatus = [...latest.values()].map((d) => ({ ...d, accepted: rows.accepted.has(d.id) }));
  return {
    documents: withStatus,
    missing: withStatus.filter((d) => !d.accepted).map((d) => d.kind as LegalKind),
  };
}

/** The same answer for a caller that has nothing fetched yet. */
export async function getLegalStatus(user: CurrentUser): Promise<LegalStatus> {
  return buildLegalStatus(user, await fetchLegalRows());
}

export function needsOnboarding(user: CurrentUser, legal: LegalStatus): boolean {
  return user.profile.first_name.trim() === "" || legal.missing.length > 0;
}
