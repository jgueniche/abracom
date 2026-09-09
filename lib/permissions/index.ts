import type { MembershipRole, MembershipStatus } from "@/lib/supabase/types";

/** The subset of a membership row the permission helpers need. */
export type MembershipLike = {
  schoolId: string;
  role: MembershipRole;
  status: MembershipStatus;
};

/** Navigation perspective for users who hold several roles (brief §5: parent + teacher…). */
export type Perspective = "admin" | "teacher" | "parent";

export const PERSPECTIVES: readonly Perspective[] = ["admin", "teacher", "parent"];

export const STAFF_ROLES: readonly MembershipRole[] = ["school_admin", "staff"];
export const WRITING_ROLES: readonly MembershipRole[] = [
  "school_admin",
  "staff",
  "teacher",
  "parent",
];

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function activeMemberships(memberships: readonly MembershipLike[]): MembershipLike[] {
  return memberships.filter((m) => m.status === "active");
}

export function isSuperAdmin(memberships: readonly MembershipLike[]): boolean {
  return activeMemberships(memberships).some((m) => m.role === "super_admin");
}

export function hasSchoolRole(
  memberships: readonly MembershipLike[],
  schoolId: string,
  roles: readonly MembershipRole[],
): boolean {
  if (isSuperAdmin(memberships)) return true;
  return activeMemberships(memberships).some(
    (m) => m.schoolId === schoolId && roles.includes(m.role),
  );
}

export function isSchoolMember(memberships: readonly MembershipLike[], schoolId: string): boolean {
  return (
    isSuperAdmin(memberships) || activeMemberships(memberships).some((m) => m.schoolId === schoolId)
  );
}

export function isSchoolStaff(memberships: readonly MembershipLike[], schoolId: string): boolean {
  return hasSchoolRole(memberships, schoolId, STAFF_ROLES);
}

export function isSchoolAdmin(memberships: readonly MembershipLike[], schoolId: string): boolean {
  return hasSchoolRole(memberships, schoolId, ["school_admin"]);
}

/** Guardians are read-only: no messages, no posts, no community posts. */
export function canWriteInSchool(
  memberships: readonly MembershipLike[],
  schoolId: string,
): boolean {
  return hasSchoolRole(memberships, schoolId, WRITING_ROLES);
}

export function schoolIdsFor(memberships: readonly MembershipLike[]): string[] {
  return [...new Set(activeMemberships(memberships).map((m) => m.schoolId))];
}

/** Perspectives available to a user, in priority order (admin > teacher > parent). */
export function perspectivesFor(memberships: readonly MembershipLike[]): Perspective[] {
  const roles = new Set(activeMemberships(memberships).map((m) => m.role));
  const result: Perspective[] = [];
  if (roles.has("super_admin") || roles.has("school_admin") || roles.has("staff"))
    result.push("admin");
  if (roles.has("teacher")) result.push("teacher");
  if (roles.has("parent") || roles.has("guardian")) result.push("parent");
  return result;
}

export function isPerspective(value: unknown): value is Perspective {
  return typeof value === "string" && (PERSPECTIVES as readonly string[]).includes(value);
}

/** The requested perspective if the user holds it, otherwise the highest available one. */
export function resolvePerspective(
  memberships: readonly MembershipLike[],
  requested: string | null | undefined,
): Perspective | null {
  const available = perspectivesFor(memberships);
  if (isPerspective(requested) && available.includes(requested)) return requested;
  return available[0] ?? null;
}

/** Throws `ForbiddenError` unless the user holds one of `roles` in the school (or is super admin). */
export function assertSchoolRole(
  memberships: readonly MembershipLike[],
  schoolId: string,
  roles: readonly MembershipRole[],
): void {
  if (!hasSchoolRole(memberships, schoolId, roles)) throw new ForbiddenError();
}
