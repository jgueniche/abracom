import { type NextRequest, NextResponse } from "next/server";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { diffDays } from "@/lib/calendar/dates";
import { appName } from "@/lib/env";
import { type ReportLevel, type ReportPeriod, renderReportCard } from "@/lib/pdf/report-card";
import { getStudentReport } from "@/server/queries/assessments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Skills report card of a student (RLS decides what the caller may see: parents only see published data). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!UUID.test(studentId)) return new NextResponse(null, { status: 404 });
  await requireCurrentUser();
  const periodFilter = request.nextUrl.searchParams.get("period");
  const [report, locale, t, format] = await Promise.all([
    getStudentReport(studentId),
    getLocale(),
    getTranslations("assessments"),
    getFormatter(),
  ]);
  if (!report) return new NextResponse(null, { status: 404 });

  const labelOf = (skill: { label_fr: string; label_en: string }) =>
    locale === "en" ? skill.label_en : skill.label_fr;
  type SortedSkill = ReportPeriod["domains"][number]["skills"][number] & { sort: number };
  type Draft = Omit<ReportPeriod, "domains"> & {
    domains: Array<{ domain: string; skills: SortedSkill[] }>;
    sort: number;
    starts: string;
    ends: string;
  };
  const periods = new Map<string, Draft>();
  for (const row of report.assessments) {
    const period = row.period!;
    if (periodFilter && period.id !== periodFilter) continue;
    let entry: Draft | undefined = periods.get(period.id);
    if (!entry) {
      entry = {
        label: period.label,
        range: `${format.dateTime(new Date(`${period.starts_on}T12:00:00Z`), { dateStyle: "medium" })} – ${format.dateTime(new Date(`${period.ends_on}T12:00:00Z`), { dateStyle: "medium" })}`,
        domains: [],
        remark: report.remarks.find((r) => r.period_id === period.id)?.body ?? null,
        absences: { days: 0, lates: 0 },
        hasDraft: false,
        sort: period.sort_order,
        starts: period.starts_on,
        ends: period.ends_on,
      };
      periods.set(period.id, entry);
    }
    const skill = row.skill!;
    let group = entry.domains.find((d) => d.domain === skill.domain);
    if (!group) {
      group = { domain: skill.domain, skills: [] };
      entry.domains.push(group);
    }
    const published = row.published_at !== null && new Date(row.published_at) <= new Date();
    if (!published) entry.hasDraft = true;
    group.skills.push({
      label: labelOf(skill),
      level: (row.level as ReportLevel | null) ?? null,
      score: row.score !== null ? `${row.score}${row.score_scale ?? ""}` : null,
      comment: row.comment,
      published,
      sort: skill.sort_order,
    } as ReportPeriod["domains"][number]["skills"][number] & { sort: number });
  }
  for (const entry of periods.values()) {
    for (const domain of entry.domains) {
      domain.skills.sort((a, b) => (a as { sort: number }).sort - (b as { sort: number }).sort);
    }
    for (const absence of report.absences) {
      if (absence.starts_on > entry.ends || absence.ends_on < entry.starts) continue;
      if (absence.kind === "late") entry.absences.lates += 1;
      else entry.absences.days += diffDays(absence.starts_on, absence.ends_on) + 1;
    }
  }

  const enrollment = report.enrollment;
  const levelLabel = enrollment?.class?.level
    ? locale === "en"
      ? enrollment.class.level.label_en
      : enrollment.class.level.label_fr
    : "";
  const buffer = await renderReportCard({
    appName,
    school: report.student.school?.name ?? appName,
    student: {
      firstName: report.student.first_name,
      lastName: report.student.last_name,
      birthDate: report.student.birth_date,
    },
    className: enrollment?.class?.name ?? "",
    levelLabel,
    teachers: (enrollment?.class?.class_teachers ?? [])
      .filter((ct) => ct.role === "main" && ct.profile)
      .map((ct) => `${ct.profile!.first_name} ${ct.profile!.last_name}`),
    periods: [...periods.values()]
      .sort((a, b) => a.sort - b.sort)
      .map(({ sort: _sort, starts: _starts, ends: _ends, domains, ...period }) => ({
        ...period,
        domains: domains.map((d) => ({
          domain: d.domain,
          skills: d.skills.map(({ sort: _skillSort, ...skill }) => skill),
        })),
      })),
    generatedAt: new Date().toISOString(),
    labels: {
      title: t("pdfLabels.title"),
      period: t("pdfLabels.period"),
      born: report.student.birth_date
        ? t("pdfLabels.born", {
            date: format.dateTime(new Date(`${report.student.birth_date}T12:00:00Z`), {
              dateStyle: "long",
            }),
          })
        : null,
      classLabel: t("pdfLabels.class"),
      teacher: t("pdfLabels.teacher"),
      legend: t("legend"),
      levels: {
        not_yet: t("levels.not_yet"),
        in_progress: t("levels.in_progress"),
        acquired: t("levels.acquired"),
        mastered: t("levels.mastered"),
      },
      remark: t("pdfLabels.remark"),
      absences: t("pdfLabels.absences"),
      absencesText: (absences) =>
        absences.days === 0 && absences.lates === 0
          ? t("pdfLabels.none")
          : `${t("absences.days", { count: absences.days })} · ${t("absences.lates", { count: absences.lates })}`,
      none: t("pdfLabels.none"),
      draft: t("pdfLabels.draft"),
      noData: t("pdfLabels.noData"),
      generatedOn: t("pdfLabels.generatedOn", {
        date: format.dateTime(new Date(), { dateStyle: "long" }),
        app: appName,
      }),
      confidentiality: t("pdfLabels.confidentiality"),
    },
  });

  const filename = `livret-${slug(`${report.student.first_name}-${report.student.last_name}`)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
