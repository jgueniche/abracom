import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getMfaStatus } from "@/lib/auth/mfa";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { type CurrentUser, requireCurrentUser } from "@/lib/auth/session";
import { mfaRequiredFor } from "@/lib/auth/policy";
import { ForbiddenError, hasSchoolRole, STAFF_ROLES } from "@/lib/permissions";
import type { MembershipRole } from "@/lib/supabase/types";

export type SchoolContext = { user: CurrentUser; schoolId: string };

/** Pages: redirect home unless the user holds one of `roles` in their school. */
export async function requireSchoolRole(roles: readonly MembershipRole[]): Promise<SchoolContext> {
  const user = await requireCurrentUser();
  const schoolId = user.school?.id;
  if (!schoolId || !hasSchoolRole(user.roles, schoolId, roles)) redirect(APP_HOME_PATH);
  await enforceStaffMfa(user, schoolId, "page");
  return { user, schoolId };
}

/**
 * Two-factor policy: an enrolled person must have verified their code in this session before
 * reaching staff screens; the direction must enrol first where the school requires it
 * (`modules.security.mfaRequired`, off during the QA phase).
 */
export async function enforceStaffMfa(
  user: CurrentUser,
  _schoolId: string,
  mode: "page" | "action",
) {
  const mfa = await getMfaStatus();
  if (mfa.enrolled && !mfa.verified) {
    if (mode === "action") throw new ForbiddenError();
    const pathname = (await headers()).get("x-pathname") ?? APP_HOME_PATH;
    redirect(`/verification?next=${encodeURIComponent(pathname)}`);
  }
  if (!mfa.enrolled && mfaRequiredFor(user)) {
    if (mode === "action") throw new ForbiddenError();
    redirect("/profil/securite?requis=1");
  }
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
  await enforceStaffMfa(user, schoolId, "action");
  return { user, schoolId };
}
