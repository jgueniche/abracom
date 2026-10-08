import type { Json } from "@/lib/supabase/database.types";

/** What the choice needs of a membership row: its status and the school it opens. */
type MembershipWithSchool<S> = { status: string; school: S | null };

/**
 * The schools a person may work in: those of their active memberships, each
 * once, in the order the memberships were created.
 */
export function schoolsOf<S extends { id: string }>(rows: readonly MembershipWithSchool<S>[]): S[] {
  const seen = new Set<string>();
  const result: S[] = [];
  for (const row of rows) {
    if (row.status !== "active" || !row.school || seen.has(row.school.id)) continue;
    seen.add(row.school.id);
    result.push(row.school);
  }
  return result;
}

/**
 * The school the application works in for this request.
 *
 * It used to be « the first active membership », full stop: someone in two
 * schools only ever saw the older one, with no way to reach the other. The
 * school asked for (the selector's cookie) wins when the person may work in it;
 * otherwise the first real one — the test school is older than any real school
 * (ADR-0073), and whoever belongs to both comes for the real one — and only then
 * the first at all. A cookie naming a school they have left, or someone else's,
 * is simply ignored. An invited person who has not signed in yet still gets
 * their school, for the onboarding screen.
 */
export function pickSchool<S extends { id: string; modules?: Json }>(
  rows: readonly MembershipWithSchool<S>[],
  requested: string | null | undefined,
): S | null {
  const schools = schoolsOf(rows);
  return (
    schools.find((school) => school.id === requested) ??
    schools.find((school) => !isTestSchool(school)) ??
    schools[0] ??
    rows[0]?.school ??
    null
  );
}

/** The test school says so in its modules (ADR-0073): a band reminds anyone inside it. */
export function isTestSchool(school: { modules?: Json } | null | undefined): boolean {
  const modules = school?.modules;
  return (
    typeof modules === "object" &&
    modules !== null &&
    !Array.isArray(modules) &&
    (modules as Record<string, Json>).test === true
  );
}
