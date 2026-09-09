import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
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
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/admin/familles">{tAdmin("families")}</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/publier">{tAdmin("announcements")}</Link>
            </Button>
          </>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3">{tDash("queue")}</h2>
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
                  className="flex h-full min-h-16 items-center gap-3 rounded-xl border border-brick/35 bg-card p-4 shadow-soft transition-colors hover:bg-accent/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brick/10 text-sm font-semibold text-brick tabular-nums">
                    {row.count}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{row.label}</span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="font-sans text-3xl font-semibold tabular-nums">
                {tile.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardDescription>{t("admin.activation")}</CardDescription>
            <CardTitle className="font-sans text-3xl font-semibold tabular-nums">
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

      <h2 className="mb-3">{t("admin.classesTitle")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {classes.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
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
        ))}
      </div>
    </>
  );
}
