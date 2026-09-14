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
  const user = {
    id: userId,
    email: typeof claims?.claims?.email === "string" ? claims.claims.email : null,
    aal: typeof claims?.claims?.aal === "string" ? claims.claims.aal : null,
  };

  const [{ data: profile }, { data: contact }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("profile_contacts").select("phone").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select(
        "*, school:schools(id, slug, name, locale_default, modules, timezone, latitude, longitude)",
      )
      .eq("user_id", user.id)
      .order("created_at"),
  ]);

  const rows = memberships ?? [];
  const roles: MembershipLike[] = rows.map((m) => ({
    schoolId: m.school_id,
    role: m.role,
    status: m.status,
  }));
  const requested = (await cookies()).get(PERSPECTIVE_COOKIE)?.value;

  return {
    id: user.id,
    email: user.email,
    aal: user.aal,
    profile: profile ?? emptyProfile(user.id),
    phone: contact?.phone ?? null,
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
