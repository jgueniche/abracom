import { HELP_ROLES } from "@/lib/help/frontmatter.mjs";
import { activeMemberships, isSuperAdmin, type MembershipLike } from "@/lib/permissions";

export type HelpRole = (typeof HELP_ROLES)[number];

export const HELP_ROLE_LIST = HELP_ROLES as readonly HelpRole[];

export function isHelpRole(value: string): value is HelpRole {
  return (HELP_ROLES as readonly string[]).includes(value);
}

/**
 * The roles whose articles this reader gets.
 *
 * Not the navigation perspective: help is not a point of view, it is a set of
 * rights. Someone who is both a parent and a teacher has questions about both,
 * and switching perspective to find out how to hand in a homework note would be
 * absurd.
 *
 * A super admin is given the direction and secretariat shelves on top of their
 * own, because `hasSchoolRole()` really does open those screens to them — the
 * help would otherwise describe an application they do not have.
 */
export function helpRolesFor(memberships: readonly MembershipLike[]): HelpRole[] {
  const roles = new Set<HelpRole>();
  for (const membership of activeMemberships(memberships)) {
    if (isHelpRole(membership.role)) roles.add(membership.role);
  }
  if (isSuperAdmin(memberships)) {
    roles.add("super_admin");
    roles.add("school_admin");
    roles.add("staff");
  }
  // Someone invited but not yet active still has to be told how to sign in.
  if (roles.size === 0) roles.add("parent");
  return HELP_ROLE_LIST.filter((role) => roles.has(role));
}
