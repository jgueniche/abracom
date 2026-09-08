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
  profile: Tables<"profiles">;
  memberships: Array<Tables<"memberships"> & { school: SchoolSummary | null }>;
  /** Normalised memberships for `lib/permissions`. */
  roles: MembershipLike[];
  perspectives: Perspective[];
  perspective: Perspective | null;
  /** First active school (single-school users). */
  school: SchoolSummary | null;
};

/** Loads the signed-in user with profile and memberships. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) return null;
    throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
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
    email: user.email ?? null,
    profile: profile ?? emptyProfile(user.id),
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
    phone: null,
    avatar_path: null,
    locale: "fr",
    show_hebrew_date: false,
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
