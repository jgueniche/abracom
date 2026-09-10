import { BackpackIcon } from "lucide-react";
import {
  BookOpenIcon,
  CalendarXIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  ImagesIcon,
  MessageSquareTextIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StudentCard } from "@/components/domain/student-card";
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
  { segment: "devoirs", key: "homework", icon: BookOpenIcon },
  { segment: "cahier", key: "journal", icon: ImagesIcon },
  { segment: "mots", key: "notes", icon: MessageSquareTextIcon },
  { segment: "evaluations", key: "assessments", icon: GraduationCapIcon },
  { segment: "absences", key: "absences", icon: CalendarXIcon },
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
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {readOnly && <p className="mb-4 text-sm text-muted-foreground">{t("readOnly")}</p>}
      {children.length === 0 ? (
        <EmptyState icon={BackpackIcon} title={t("noChildren")} description={t("noChildrenHint")} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {children.map((child) => {
            const classId = child.student.enrollments[0]?.class?.id;
            return (
              <div key={child.student.id} className="flex flex-col gap-3">
                <StudentCard child={child} />
                {classId && (
                  <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
                    {sections.map(({ segment, key, icon: Icon }) => (
                      <li key={segment} className="border-b border-border/70 last:border-b-0">
                        <Link
                          href={`/classes/${classId}/${segment}`}
                          className="flex min-h-12 items-center gap-3 px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          {tSpace(key)}
                          <ChevronRightIcon
                            className="ml-auto size-4 text-muted-foreground"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
