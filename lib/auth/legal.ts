import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export const LEGAL_KINDS = ["terms", "charter", "privacy"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export type LegalStatus = {
  /** Latest version of each kind (school-specific first, then platform-wide). */
  documents: Array<Tables<"legal_documents"> & { accepted: boolean }>;
  missing: LegalKind[];
};

/** Which legal texts the user still has to accept (versioned, timestamped acceptances). */
export async function getLegalStatus(user: CurrentUser): Promise<LegalStatus> {
  const supabase = await createClient();
  const schoolIds = [...new Set(user.memberships.map((m) => m.school_id))];
  const scope = schoolIds.length
    ? `school_id.is.null,school_id.in.(${schoolIds.join(",")})`
    : "school_id.is.null";

  const [{ data: documents }, { data: acceptances }] = await Promise.all([
    supabase
      .from("legal_documents")
      .select("*")
      .or(scope)
      .eq("locale", user.profile.locale)
      .order("published_at", { ascending: false }),
    supabase.from("legal_acceptances").select("legal_document_id").eq("user_id", user.id),
  ]);

  const accepted = new Set((acceptances ?? []).map((a) => a.legal_document_id));
  const latest = new Map<LegalKind, Tables<"legal_documents">>();
  for (const kind of LEGAL_KINDS) {
    const candidates = (documents ?? []).filter((d) => d.kind === kind);
    const pick = candidates.find((d) => d.school_id !== null) ?? candidates[0];
    if (pick) latest.set(kind, pick);
  }

  const withStatus = [...latest.values()].map((d) => ({ ...d, accepted: accepted.has(d.id) }));
  return {
    documents: withStatus,
    missing: withStatus.filter((d) => !d.accepted).map((d) => d.kind as LegalKind),
  };
}

export function needsOnboarding(user: CurrentUser, legal: LegalStatus): boolean {
  return user.profile.first_name.trim() === "" || legal.missing.length > 0;
}
