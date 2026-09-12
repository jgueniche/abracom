import { BackpackIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ChildAttendance } from "@/components/domain/child-attendance";
import { StudentCard } from "@/components/domain/student-card";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { EmptyState } from "@/components/domain/empty-state";
import { requireCurrentUser } from "@/lib/auth/session";
import { canSeeAssessments } from "@/lib/permissions";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("family");
  return { title: t("title") };
}

/** Sections of a child's file, in the order a parent actually asks for them. */
const SECTIONS = [
  // Same order as the class space's own tabs.
  { segment: "cahier", key: "journal" },
  { segment: "devoirs", key: "homework" },
  { segment: "mots", key: "notes" },
  { segment: "absences", key: "absences" },
  { segment: "evaluations", key: "assessments" },
] as const;

/**
 * "Mon enfant" — homework, journal, notes, assessments and absences are things
 * that belong to a child, and they used to be reachable only through tabs of a
 * class, two levels down, behind a relay screen.
 */
export default async function FamilyPage() {
  const user = await requireCurrentUser();
  const [t, tSpace, children] = await Promise.all([
    getTranslations("family"),
    getTranslations("classSpace.tabs"),
    getMyChildren(),
  ]);
  const readOnly =
    user.roles.some((r) => r.role === "guardian") && !user.roles.some((r) => r.role === "parent");
  // The page announces "no assessments, no messaging" and then offered an
  // Évaluations row six lines below it.
  const showAssessments = user.school ? canSeeAssessments(user.roles, user.school.id) : false;
  const sections = SECTIONS.filter((s) => s.segment !== "evaluations" || showAssessments);

  return (
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {readOnly && <p className="mb-4 text-sm text-muted-foreground">{t("readOnly")}</p>}
      {children.length === 0 ? (
        <EmptyState icon={BackpackIcon} title={t("noChildren")} description={t("noChildrenHint")} />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          {children.map((child) => {
            const classId = child.student.enrollments[0]?.class?.id;
            return (
              <div key={child.student.id} className="flex flex-col gap-3">
                <StudentCard
                  child={child}
                  footer={
                    classId ? (
                      // Five destinations, five names. The glyph that used to
                      // sit before each one said nothing the word did not, and
                      // a column of little pictures beside a column of words is
                      // the shape this interface is trying to leave behind.
                      <ul className="flex flex-wrap gap-0.5">
                        {sections.map(({ segment, key }) => (
                          <li key={segment}>
                            <Link
                              href={`/classes/${classId}/${segment}`}
                              className="flex min-h-11 items-center rounded-md px-2.5 text-[0.8125rem] font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                            >
                              {tSpace(key)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : undefined
                  }
                />
                <ChildAttendance studentId={child.student.id} />
              </div>
            );
          })}
        </div>
      )}
    </Column>
  );
}
