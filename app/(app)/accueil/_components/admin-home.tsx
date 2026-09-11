import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AttendanceToday } from "@/components/domain/attendance-today";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <>
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
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {queue.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex h-full min-h-14 items-center gap-2.5 rounded-xl border border-l-2 border-border border-l-brick bg-card px-3.5 py-2.5 transition-colors hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_16%)] hover:bg-muted/50"
                >
                  <span className="text-base font-semibold text-brick tabular-nums">
                    {row.count}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{row.label}</span>
                  <ChevronRightIcon
                    className="size-3.5 shrink-0 text-muted-foreground/60"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardDescription className="eyebrow">{tile.label}</CardDescription>
              <CardTitle className="font-sans text-2xl leading-none font-semibold tabular-nums">
                {tile.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardDescription className="eyebrow">{t("admin.activation")}</CardDescription>
            <CardTitle className="font-sans text-2xl leading-none font-semibold tabular-nums">
              {stats.parentsTotal
                ? Math.round((stats.parentsActive / stats.parentsTotal) * 100)
                : 0}{" "}
              %
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t("admin.activationHint", { active: stats.parentsActive, total: stats.parentsTotal })}
          </CardContent>
        </Card>
      </div>

      <SectionHeader label={t("admin.classesTitle")} count={classes.length || undefined} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {/* six inert cards on the opening screen of the direction, while the
            same cards open the class space from a teacher's home */}
        {classes.map((c) => (
          <Link key={c.id} href={`/classes/${c.id}`} className="block">
            <Card className="h-full transition-colors hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_16%)] hover:bg-muted/50">
              <CardHeader>
                <div className="mb-0.5 flex items-center gap-2">
                  <Badge variant="secondary">{c.level?.code}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("teacher.students", { count: c.enrollments[0]?.count ?? 0 })}
                  </span>
                </div>
                <CardTitle>{c.name}</CardTitle>
                <CardDescription>
                  {c.class_teachers
                    .filter((ct) => ct.role === "main" && ct.profile)
                    .map((ct) => `${ct.profile!.first_name} ${ct.profile!.last_name}`)
                    .join(", ") || tFamily("teacherRole.main")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
