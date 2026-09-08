import "server-only";

import { redirect } from "next/navigation";

import { APP_HOME_PATH } from "@/lib/auth/routes";
import { type CurrentUser, requireCurrentUser } from "@/lib/auth/session";
import { ForbiddenError, hasSchoolRole, STAFF_ROLES } from "@/lib/permissions";
import type { MembershipRole } from "@/lib/supabase/types";

export type SchoolContext = { user: CurrentUser; schoolId: string };

/** Pages: redirect home unless the user holds one of `roles` in their school. */
export async function requireSchoolRole(roles: readonly MembershipRole[]): Promise<SchoolContext> {
  const user = await requireCurrentUser();
  const schoolId = user.school?.id;
  if (!schoolId || !hasSchoolRole(user.roles, schoolId, roles)) redirect(APP_HOME_PATH);
  return { user, schoolId };
}

export const requireSchoolStaff = () => requireSchoolRole(STAFF_ROLES);
export const requireSchoolAdmin = () => requireSchoolRole(["school_admin"]);

/** Server Actions: same check but throws (the action turns it into a French message). */
export async function assertSchoolContext(
  roles: readonly MembershipRole[],
): Promise<SchoolContext> {
  const user = await requireCurrentUser();
  const schoolId = user.school?.id;
  if (!schoolId || !hasSchoolRole(user.roles, schoolId, roles)) throw new ForbiddenError();
  return { user, schoolId };
}
