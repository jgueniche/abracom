import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { LOGIN_PATH, PERSPECTIVE_COOKIE } from "@/lib/auth/routes";
import { MissingSupabaseConfigError } from "@/lib/env";
import {
  type MembershipLike,
  type Perspective,
  perspectivesFor,
  resolvePerspective,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type SchoolSummary = Pick<
  Tables<"schools">,
  "id" | "slug" | "name" | "locale_default" | "modules" | "timezone" | "latitude" | "longitude"
>;

export type CurrentUser = {
  id: string;
  email: string | null;
  /** Assurance level of the session, straight from the JWT claim: 'aal1' or 'aal2'. */
  aal: string | null;
  profile: Tables<"profiles">;
  /** Contact details live apart from the shared profile (profile_contacts). */
  phone: string | null;
  memberships: Array<Tables<"memberships"> & { school: SchoolSummary | null }>;
  /** Normalised memberships for `lib/permissions`. */
  roles: MembershipLike[];
  perspectives: Perspective[];
  perspective: Perspective | null;
  /** First active school (single-school users). */
  school: SchoolSummary | null;
};

/**
 * The signed-in user's identifier, and nothing else.
 *
 * Reading it costs nothing — the JWT's signature is verified locally — so a
 * query that needs only "who is asking" no longer has to wait for the profile,
 * the contacts and the memberships to come back first (ADR-0061).
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) return null;
    throw error;
  }
});

/**
 * Everything the signed-in shell needs, in one round trip.
 *
 * The profile, the contacts, the memberships with their school, the legal texts
 * and their acceptances, the two-factor state and the two unread counts used to
 * be **eight** separate requests, paid on every page. They ran in parallel, but
 * parallel is not free: eight connections and eight round trips, and on a shared
 * database that is what shows (ADR-0062). `session_context()` returns the lot.
 *
 * **It falls back to the eight requests when the function is not there.** The
 * SQL migrations of this project are applied to the hosted database by hand,
 * before the deployment; a build that reaches production first must keep working
 * rather than log everyone out. The fallback is the old code, unchanged.
 */
export type SessionContext = {
  profile: Tables<"profiles"> | null;
  phone: string | null;
  memberships: Array<Tables<"memberships"> & { school: SchoolSummary | null }>;
  legalDocuments: Tables<"legal_documents">[];
  legalAccepted: string[];
  mfaEnrolled: boolean | null;
  unreadMessages: number | null;
  unreadNotifications: number | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) return null;
    throw error;
  }
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase.rpc("session_context");
  if (!error && data && typeof data === "object" && !Array.isArray(data)) {
    const row = data as Record<string, unknown>;
    return {
      profile: (row.profile as Tables<"profiles"> | null) ?? null,
      phone: typeof row.phone === "string" ? row.phone : null,
      memberships: asArray(row.memberships),
      legalDocuments: asArray(row.legalDocuments),
      legalAccepted: asArray<string>(row.legalAccepted),
      mfaEnrolled: row.mfaEnrolled === true,
      unreadMessages: Number(row.unreadMessages ?? 0),
      unreadNotifications: Number(row.unreadNotifications ?? 0),
    };
  }

  // The database does not know the function yet: the eight requests, as before.
  const [{ data: profile }, { data: contact }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("profile_contacts").select("phone").eq("user_id", userId).maybeSingle(),
    supabase
      .from("memberships")
      .select(
        "*, school:schools(id, slug, name, locale_default, modules, timezone, latitude, longitude)",
      )
      .eq("user_id", userId)
      .order("created_at"),
  ]);
  return {
    profile: profile ?? null,
    phone: contact?.phone ?? null,
    memberships: memberships ?? [],
    legalDocuments: [],
    legalAccepted: [],
    // `null` means "not answered here": each caller falls back to its own query.
    mfaEnrolled: null,
    unreadMessages: null,
    unreadNotifications: null,
  };
});

/** Loads the signed-in user with profile and memberships. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) return null;
    throw error;
  }

  // The signed-in identity comes from the JWT the browser already sent, whose
  // ES256 signature is verified locally against the cached JWKS — not from a
  // round trip to the auth server, which the middleware has just paid for the
  // same token (ADR-0061). RLS still checks that same token in Postgres, so a
  // membership revoked mid-session stops the data at the source; what the
  // claims cannot see is a user deleted between two token refreshes, which
  // Postgres would answer with an empty result anyway.
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;

  const context = await getSessionContext();
  const rows = context?.memberships ?? [];
  const roles: MembershipLike[] = rows.map((m) => ({
    schoolId: m.school_id,
    role: m.role,
    status: m.status,
  }));
  const requested = (await cookies()).get(PERSPECTIVE_COOKIE)?.value;

  return {
    id: userId,
    email: typeof claims?.claims?.email === "string" ? claims.claims.email : null,
    aal: typeof claims?.claims?.aal === "string" ? claims.claims.aal : null,
    profile: context?.profile ?? emptyProfile(userId),
    phone: context?.phone ?? null,
    memberships: rows,
    roles,
    perspectives: perspectivesFor(roles),
    perspective: resolvePerspective(roles, requested),
    school: rows.find((m) => m.status === "active")?.school ?? rows[0]?.school ?? null,
  };
});

/** Redirects to the login page when there is no session. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

function emptyProfile(id: string): Tables<"profiles"> {
  const now = new Date().toISOString();
  return {
    id,
    first_name: "",
    last_name: "",
    avatar_path: null,
    locale: "fr",
    show_hebrew_date: false,
    accepts_parent_dm: true,
    last_seen_at: null,
    anonymized_at: null,
    deletion_requested_at: null,
    created_at: now,
    updated_at: now,
  };
}

export function displayName(profile: Pick<Tables<"profiles">, "first_name" | "last_name">): string {
  return `${profile.first_name} ${profile.last_name}`.trim();
}

export function initials(profile: Pick<Tables<"profiles">, "first_name" | "last_name">): string {
  return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase() || "?";
}
