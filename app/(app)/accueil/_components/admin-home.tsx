import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AttendanceToday } from "@/components/domain/attendance-today";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth/session";
import { getAdminAnnouncements } from "@/server/queries/announcements";
import { getSchoolClasses } from "@/server/queries/classes";
import { getAdminClassifieds } from "@/server/queries/community";
import { getOpenReports } from "@/server/queries/messaging";
import { getSchoolStats } from "@/server/queries/school";

/**
 * The head teacher's home was four inert tiles and a redirect to Families.
 * It now opens on the actual queue: what is waiting on a decision today,
 * each line a link straight to the screen that resolves it.
 */
export async function AdminHome({ user }: { user: CurrentUser }) {
  const t = await getTranslations("appHome");
  const tFamily = await getTranslations("family");
  const tAdmin = await getTranslations("admin.nav");
  const tDash = await getTranslations("admin.dashboard");
  const tPublish = await getTranslations("publish");
  const schoolId = user.school?.id;
  if (!schoolId) return <PageHeader title={t("admin.title")} />;

  const [stats, classes, reports, announcements, classifieds] = await Promise.all([
    getSchoolStats(schoolId),
    getSchoolClasses(schoolId),
    getOpenReports(schoolId),
    getAdminAnnouncements(schoolId),
    getAdminClassifieds(schoolId),
  ]);

  const openReports = reports.filter((report) => report.status === "open").length;
  const scheduled = announcements.filter((a) => a.status === "scheduled").length;
  const pendingClassifieds = classifieds.filter((c) => c.status === "pending").length;
  // A receipt still missing after three days is the one that needs chasing.
  const chaseAfter = Date.now() - 3 * 86_400_000;
  const lateAcks = announcements.filter(
    (a) =>
      a.requires_ack &&
      a.status === "published" &&
      a.published_at !== null &&
      new Date(a.published_at).getTime() < chaseAfter,
  ).length;

  const queue = [
    {
      id: "reports",
      count: openReports,
      href: "/admin/signalements",
      label: tDash("openReports", { count: openReports }),
    },
    {
      id: "classifieds",
      count: pendingClassifieds,
      href: "/admin/communaute",
      label: tDash("pendingClassifieds", { count: pendingClassifieds }),
    },
    {
      id: "scheduled",
      count: scheduled,
      href: "/admin/annonces",
      label: tDash("scheduled", { count: scheduled }),
    },
    {
      id: "acks",
      count: lateAcks,
      href: "/admin/annonces",
      label: tDash("lateAcks", { count: lateAcks }),
    },
  ].filter((row) => row.count > 0);

  const tiles = [
    { label: t("admin.students"), value: stats.students },
    { label: t("admin.families"), value: stats.families },
    { label: t("admin.classes"), value: stats.classes },
  ];

  return (
    <Column>
      <PageHeader
        eyebrow={user.school?.name}
        title={tDash("title")}
        description={tDash("subtitle")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/familles">{tAdmin("families")}</Link>
            </Button>
            <Button asChild>
              {/* labelled "Annonces" while it opened the publishing hub */}
              <Link href="/publier">{tPublish("title")}</Link>
            </Button>
          </>
        }
      />
      <AttendanceToday />

      <section className="mb-10">
        <SectionHeader label={tDash("queue")} count={queue.length || undefined} />
        {queue.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-2 text-muted-foreground">
              <CheckCircle2Icon className="size-5 text-success" aria-hidden />
              {tDash("nothing")}
            </CardContent>
          </Card>
        ) : (
          <ul>
            {queue.map((row) => (
              <li key={row.id} className="relative border-b border-rule last:border-b-0">
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 -left-3 w-[2px] rounded-full bg-brick sm:-left-4"
                />
                <Link
                  href={row.href}
                  className="-mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium">{row.label}</span>
                  <span className="shrink-0 text-sm font-semibold text-brick tabular-nums">
                    {row.count}
                  </span>
                  <ChevronRightIcon
                    className="size-3.5 shrink-0 text-muted-foreground/50"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Four figures are four figures, not four boxes: a strip between two
          rules, which is what a school's key numbers look like on paper. */}
      <dl className="mb-10 grid grid-cols-2 gap-x-10 gap-y-6 border-y border-rule py-5 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <dt className="eyebrow">{tile.label}</dt>
            <dd className="mt-1 text-2xl leading-none font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
        <div>
          <dt className="eyebrow">{t("admin.activation")}</dt>
          <dd className="mt-1 text-2xl leading-none font-semibold tabular-nums">
            {stats.parentsTotal ? Math.round((stats.parentsActive / stats.parentsTotal) * 100) : 0}{" "}
            %
          </dd>
          <dd className="mt-1.5 text-xs text-muted-foreground">
            {t("admin.activationHint", {
              active: stats.parentsActive,
              total: stats.parentsTotal,
            })}
          </dd>
        </div>
      </dl>

      <SectionHeader label={t("admin.classesTitle")} count={classes.length || undefined} />
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("admin.columnClass")}</TableHead>
            <TableHead>{t("admin.columnLevel")}</TableHead>
            <TableHead className="text-right">{t("admin.columnPupils")}</TableHead>
            <TableHead>{t("admin.columnTeacher")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* six inert cards on the opening screen of the direction, while the
              same cards open the class space from a teacher's home */}
          {classes.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/classes/${c.id}`}
                  className="after:absolute after:inset-0 hover:underline hover:underline-offset-[3px]"
                >
                  {c.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{c.level?.code}</TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {c.enrollments[0]?.count ?? 0}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.class_teachers
                  .filter((ct) => ct.role === "main" && ct.profile)
                  .map((ct) => `${ct.profile!.first_name} ${ct.profile!.last_name}`)
                  .join(", ") || tFamily("teacherRole.main")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Column>
  );
}
