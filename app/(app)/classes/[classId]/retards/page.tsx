import { ClockAlertIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Button } from "@/components/ui/button";
import { requireClassAccess } from "@/lib/auth/class-access";
import { getLateReport } from "@/server/queries/timetable";

/** Windows a teacher actually asks for. 30 days is the default. */
const WINDOWS = [30, 90, 365] as const;

/**
 * Late arrivals, both registers added up (session 20).
 *
 * Nothing new is collected: what the family declared (`absences.kind = 'late'`)
 * and what the pointeuse observed are two counts of the same thing, and neither
 * was ever put beside the other.
 */
export default async function LatePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ jours?: string }>;
}) {
  const [{ classId }, search] = await Promise.all([params, searchParams]);
  const { cls, isTeacher, isStaff } = await requireClassAccess(classId);
  // Lateness across a class is a staff reading, never a family one.
  if (!isTeacher && !isStaff) redirect(`/classes/${classId}`);

  const [t, format] = await Promise.all([getTranslations("late"), getFormatter()]);
  const requested = Number(search.jours);
  const days = (WINDOWS as readonly number[]).includes(requested) ? requested : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const rows = await getLateReport(cls.school_id, iso(from), iso(to), classId);
  const total = rows.reduce(
    (n, row) => n + Number(row.declared_late) + Number(row.observed_late),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((window) => (
          <Button
            key={window}
            asChild
            variant={window === days ? "default" : "outline"}
            size="sm"
            className="min-h-11"
          >
            <Link href={`/classes/${classId}/retards?jours=${window}`}>
              {t(`windows.${window}`)}
            </Link>
          </Button>
        ))}
        {rows.length > 0 && (
          <Button asChild variant="outline" size="sm" className="ms-auto min-h-11">
            <Link href={`/classes/${classId}/retards/export?jours=${days}`} prefetch={false}>
              <DownloadIcon aria-hidden />
              {t("exportCsv")}
            </Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ClockAlertIcon} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("summary", { count: total, pupils: rows.length })}
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.student_id}
                // A name that wraps used to let the counts slide into the middle
                // of it at 390 px: the name owns its line, the counts follow.
                className="flex flex-col gap-1 rounded-xl border border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4"
              >
                <span className="min-w-0 font-medium sm:flex-1">
                  {row.first_name} {row.last_name}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="text-sm tabular-nums">
                    {t("declared", { count: Number(row.declared_late) })}
                  </span>
                  <span className="text-sm tabular-nums">
                    {t("observed", { count: Number(row.observed_late) })}
                  </span>
                  {row.last_late && (
                    <span className="text-xs text-muted-foreground">
                      {t("lastOn", {
                        date: format.dateTime(new Date(`${row.last_late}T12:00:00`), {
                          dateStyle: "medium",
                        }),
                      })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("sources")}</p>
        </>
      )}
    </div>
  );
}
