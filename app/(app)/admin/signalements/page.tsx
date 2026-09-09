import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { resolveReport } from "@/server/actions/messaging";
import { getOpenReports } from "@/server/queries/messaging";

import { ModerateForm } from "./moderate-form";

export default async function ReportsPage() {
  const { schoolId } = await requireSchoolStaff();
  const [t, format, reports] = await Promise.all([
    getTranslations("adminReports"),
    getFormatter(),
    getOpenReports(schoolId),
  ]);
  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status === "resolved");

  const card = (report: (typeof reports)[number]) => (
    <Card key={report.id}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={report.status === "open" ? "destructive" : "secondary"}>
            {t(report.status)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format.dateTime(new Date(report.created_at), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {report.reporter
              ? ` · ${t("reporter", { name: `${report.reporter.first_name} ${report.reporter.last_name}` })}`
              : ""}
          </span>
        </div>
        <p className="text-sm">
          <span className="font-medium">{t("reason")} :</span> {report.reason}
        </p>
        {report.message && (
          <blockquote className="rounded-xl bg-muted p-3 text-sm">
            <p className="mb-1 text-xs text-muted-foreground">
              {report.message.author
                ? t("author", {
                    name: `${report.message.author.first_name} ${report.message.author.last_name}`,
                  })
                : ""}
            </p>
            {report.message.deleted_at ? <em>{t("alreadyRemoved")}</em> : report.message.body}
          </blockquote>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {report.message && (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={`/messages/${report.message.thread_id}`}>{t("openThread")}</Link>
            </Button>
          )}
          {report.status === "open" && report.message && !report.message.deleted_at && (
            <ModerateForm
              messageId={report.message.id}
              defaultReason={report.reason.slice(0, 120)}
            />
          )}
          {report.status === "open" && (
            <form action={resolveReport} className="flex items-center gap-2">
              <input type="hidden" name="reportId" value={report.id} />
              <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                {t("resolve")}
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {reports.length === 0 && <p className="text-muted-foreground">{t("none")}</p>}
      <div className="flex flex-col gap-6">
        {open.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {t("open")} ({open.length})
            </h2>
            {open.map(card)}
          </section>
        )}
        {resolved.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {t("resolved")} ({resolved.length})
            </summary>
            <div className="mt-3 flex flex-col gap-3">{resolved.map(card)}</div>
          </details>
        )}
      </div>
    </>
  );
}
