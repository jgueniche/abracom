import type { CurrentUser } from "@/lib/auth/session";

/**
 * Two-factor authentication policy (brief §8, relaxed for the QA phase): a school demands it
 * from its direction when `modules.security.mfaRequired` is true. Off by default; mirrored in SQL
 * by `mfa_required()` so that RLS and the interface agree.
 */
export function schoolRequiresMfa(modules: unknown): boolean {
  if (!modules || typeof modules !== "object") return false;
  const security = (modules as { security?: { mfaRequired?: unknown } }).security;
  return security?.mfaRequired === true;
}

export function mfaRequiredFor(user: CurrentUser): boolean {
  return user.memberships.some(
    (m) =>
      m.status === "active" && m.role === "school_admin" && schoolRequiresMfa(m.school?.modules),
  );
}
