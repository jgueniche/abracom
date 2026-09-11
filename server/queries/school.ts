import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SchoolStats = {
  students: number;
  families: number;
  classes: number;
  parentsActive: number;
  parentsTotal: number;
};

/** Headline numbers for the direction dashboard. */
export async function getSchoolStats(schoolId: string): Promise<SchoolStats> {
  const supabase = await createClient();
  const [students, families, classes, parents] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase
      .from("families")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("archived", false),
    supabase
      .from("memberships")
      .select("status")
      .eq("school_id", schoolId)
      .in("role", ["parent", "guardian"]),
  ]);

  const parentRows = parents.data ?? [];
  return {
    students: students.count ?? 0,
    families: families.count ?? 0,
    classes: classes.count ?? 0,
    parentsActive: parentRows.filter((m) => m.status === "active").length,
    parentsTotal: parentRows.length,
  };
}

export type AdminCounts = Record<string, number>;

/**
 * One live figure per management destination, keyed by the navigation key.
 *
 * `/admin` used to repeat, word for word, the twelve links of the sidebar
 * displayed next to it — the same four family names, the same twelve entries,
 * no content of its own. The figures are what makes it a summary.
 */
export async function getAdminCounts(schoolId: string): Promise<AdminCounts> {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [
    announcements,
    documents,
    events,
    forms,
    families,
    classes,
    members,
    reports,
    classifieds,
    years,
    audit,
    messaging,
    attendance,
  ] = await Promise.all([
    supabase
      .from("announcements")
      .select("id", head)
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    supabase.from("documents").select("id", head).eq("school_id", schoolId).is("deleted_at", null),
    supabase.from("events").select("id", head).eq("school_id", schoolId).is("deleted_at", null),
    supabase.from("forms").select("id", head).eq("school_id", schoolId),
    supabase.from("families").select("id", head).eq("school_id", schoolId),
    supabase.from("classes").select("id", head).eq("school_id", schoolId).eq("archived", false),
    supabase
      .from("memberships")
      .select("user_id", head)
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase.from("reports").select("id", head).eq("school_id", schoolId).eq("status", "open"),
    supabase
      .from("community_posts")
      .select("id", head)
      .eq("school_id", schoolId)
      .eq("status", "pending"),
    supabase.from("school_years").select("id", head).eq("school_id", schoolId),
    supabase.from("audit_log").select("id", head).eq("school_id", schoolId),
    // Periods running right now: the figure that says "something is shut".
    supabase
      .from("messaging_windows")
      .select("id", head)
      .eq("school_id", schoolId)
      .lte("opens_at", new Date().toISOString())
      .gt("closes_at", new Date().toISOString()),
    supabase
      .from("attendance_lists")
      .select("id", head)
      .eq("school_id", schoolId)
      .eq("archived", false),
  ]);

  return {
    announcements: announcements.count ?? 0,
    documents: documents.count ?? 0,
    events: events.count ?? 0,
    forms: forms.count ?? 0,
    families: families.count ?? 0,
    classes: classes.count ?? 0,
    members: members.count ?? 0,
    reports: reports.count ?? 0,
    community: classifieds.count ?? 0,
    years: years.count ?? 0,
    audit: audit.count ?? 0,
    messaging: messaging.count ?? 0,
    attendance: attendance.count ?? 0,
  };
}
