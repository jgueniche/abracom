import { FileDownIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { localDateKey } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { isSchoolAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AssessmentLevel } from "@/lib/assessments";
import {
  currentPeriod,
  getAssessmentPeriods,
  getClassAssessments,
  getClassRemarks,
  getSkillCatalogForClass,
  groupSkillsByDomain,
} from "@/server/queries/assessments";

import { type MatrixCell, MatrixForm } from "./matrix-form";
import { PublishButton } from "./publish-button";

const LEVEL_VARIANT: Record<AssessmentLevel, "destructive" | "outline" | "secondary" | "default"> =
  {
    not_yet: "destructive",
    in_progress: "outline",
    acquired: "secondary",
    mastered: "default",
  };

export default async function AssessmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { classId } = await params;
  const { p } = await searchParams;
  const [{ user, cls, isTeacher, isStaff, myStudentIds }, t, format, locale] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("assessments"),
    getFormatter(),
    getLocale(),
  ]);
  const isAdmin = isSchoolAdmin(user.roles, cls.school_id);
  const editor = isTeacher || isAdmin;
  if (isStaff && !editor) return <p className="text-muted-foreground">{t("noAccess")}</p>;

  const periods = await getAssessmentPeriods(cls.school_id);
  const period =
    periods.find((x) => x.id === p) ?? currentPeriod(periods, localDateKey(new Date(), TIME_ZONE));
  if (!period) return <p className="text-muted-foreground">{t("noPeriods")}</p>;

  const [{ skills }, rows, remarks] = await Promise.all([
    getSkillCatalogForClass(classId),
    getClassAssessments(classId, period.id),
    getClassRemarks(classId, period.id),
  ]);
  const domains = groupSkillsByDomain(
    skills.map((s) => ({ ...s, label: locale === "en" ? s.label_en : s.label_fr })),
  );
  const scoresEnabled =
    (cls.level?.code ?? "PS") !== "TPS" &&
    !["TPS", "PS", "MS", "GS"].includes(cls.level?.code ?? "") &&
    (user.school?.modules as { assessments?: { scores?: boolean } } | null)?.assessments?.scores ===
      true;

  const selector = (
    <nav className="flex flex-wrap gap-2" aria-label={t("period")}>
      {periods.map((x) => (
        <Link
          key={x.id}
          href={`/classes/${classId}/evaluations?p=${x.id}`}
          aria-current={x.id === period.id ? "page" : undefined}
          className={cn(
            "flex min-h-10 items-center rounded-full border px-4 text-sm font-medium",
            x.id === period.id
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:bg-accent",
          )}
        >
          {x.label}
        </Link>
      ))}
    </nav>
  );

  if (editor) {
    const cells: Record<string, MatrixCell> = {};
    for (const row of rows) {
      cells[`${row.student_id}:${row.skill_id}`] = {
        level: row.level,
        score: row.score,
        published: row.published_at !== null,
      };
    }
    const pending = rows.filter((r) => r.published_at === null).length;
    const lastPublished = rows
      .map((r) => r.published_at)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1);
    const students = [...cls.students]
      .sort(
        (a, b) =>
          a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
      )
      .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }));
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {selector}
          <p className="text-sm text-muted-foreground">
            {t("students", { count: students.length })}
            {lastPublished
              ? ` · ${t("publishedOn", { date: format.dateTime(new Date(lastPublished), { dateStyle: "medium" }) })}`
              : ""}
          </p>
        </div>
        <MatrixForm
          classId={classId}
          periodId={period.id}
          students={students}
          domains={domains.map((g) => ({
            domain: g.domain,
            skills: g.skills.map((s) => ({ id: s.id, label: s.label, code: s.code })),
          }))}
          cells={cells}
          remarks={Object.fromEntries(remarks.map((r) => [r.student_id, r.body]))}
          scoresEnabled={scoresEnabled}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t("publish")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <PublishButton classId={classId} periodId={period.id} pending={pending} />
            <div>
              <p className="mb-2 text-sm text-muted-foreground">{t("pdfHint")}</p>
              <ul className="flex flex-wrap gap-2">
                {students.map((s) => (
                  <li key={s.id}>
                    <Button asChild variant="outline" size="sm" className="min-h-10">
                      <a
                        href={`/api/livret/${s.id}?period=${period.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileDownIcon aria-hidden />
                        {s.name}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Families: published assessments of their children in this class.
  const children = cls.students.filter((s) => myStudentIds.includes(s.id));
  return (
    <div className="flex flex-col gap-6">
      {selector}
      {children.map((child) => {
        const mine = rows.filter((r) => r.student_id === child.id);
        const remark = remarks.find((r) => r.student_id === child.id);
        return (
          <Card key={child.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {child.first_name} {child.last_name}
              </CardTitle>
              {mine.length > 0 && (
                <Button asChild variant="outline" size="sm" className="min-h-10">
                  <a
                    href={`/api/livret/${child.id}?period=${period.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileDownIcon aria-hidden />
                    {t("pdf")}
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {mine.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {user.roles.some((r) => r.role === "guardian") &&
                  !user.roles.some((r) => r.role === "parent")
                    ? t("readOnly")
                    : t("nothingPublished")}
                </p>
              ) : (
                <>
                  {domains.map((group) => {
                    const items = group.skills
                      .map((skill) => ({ skill, row: mine.find((r) => r.skill_id === skill.id) }))
                      .filter((x) => x.row);
                    if (items.length === 0) return null;
                    return (
                      <div key={group.domain}>
                        <h3 className="mb-2 font-medium">{group.domain}</h3>
                        <ul className="flex flex-col gap-1">
                          {items.map(({ skill, row }) => (
                            <li
                              key={skill.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                            >
                              <span>
                                {skill.label}
                                {row!.comment && (
                                  <span className="block text-xs text-muted-foreground">
                                    {row!.comment}
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                {row!.score !== null && (
                                  <span className="text-sm font-medium">
                                    {row!.score}
                                    {row!.score_scale}
                                  </span>
                                )}
                                {row!.level && (
                                  <Badge variant={LEVEL_VARIANT[row!.level]}>
                                    {t(`levels.${row!.level}`)}
                                  </Badge>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {remark && (
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      <p className="mb-1 font-medium">{t("remark")}</p>
                      <p className="whitespace-pre-line">{remark.body}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{t("legend")}</p>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
