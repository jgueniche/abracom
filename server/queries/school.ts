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
