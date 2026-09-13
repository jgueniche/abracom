import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { AttendanceToday } from "@/components/domain/attendance-today";
import { NewHomeworkButton } from "@/components/domain/new-homework-button";
import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth/session";
import { levelLabel } from "@/lib/levels";

import { UpcomingEvents } from "@/app/(app)/agenda/_components/upcoming-events";
import { getWeeklySummary } from "@/server/queries/class-space";
import { getMyTeachingClasses } from "@/server/queries/classes";
import { getClassActivity, getTeacherQueue } from "@/server/queries/today";

/**
 * The teacher's home used to be a greeting, the day's register and a grid of
 * her own classes — no equivalent of the parent's "Aujourd'hui" block, and no
 * equivalent of the direction's queue. Session 24 recorded the gap and left it
 * for a session that could write the queries. Two sections answer the two
 * questions she opens the application with: what is waiting on me, and what
 * happened in my classes.
 */
export async function TeacherHome({ user }: { user: CurrentUser }) {
  const [t, tFamily, tWeek, format, locale, classes] = await Promise.all([
    getTranslations("appHome"),
    getTranslations("family"),
    getTranslations("classSpace.week"),
    getFormatter(),
    getLocale(),
    getMyTeachingClasses(user.id),
  ]);
  const classIds = classes.flatMap((row) => (row.class ? [row.class.id] : []));
  const [summaries, queue, activity] = await Promise.all([
    getWeeklySummary(classIds),
    getTeacherQueue(user.id, classIds),
    getClassActivity(user.id, classIds, user.school?.timezone ?? "Europe/Paris"),
  ]);

  return (
    <Column rail={<UpcomingEvents userId={user.id} />}>
      <PageHeader
        eyebrow={format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })}
        title={t("greeting", { name: user.profile.first_name })}
        description={t("teacher.subtitle")}
        actions={
          <NewHomeworkButton
            classes={classes.flatMap((row) =>
              row.class ? [{ id: row.class.id, name: row.class.name }] : [],
            )}
          />
        }
      />
      <AttendanceToday />

      <section className="mb-10">
        <SectionHeader label={t("teacher.queue")} count={queue.length || undefined} />
        {queue.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-success" aria-hidden />
            {t("teacher.queueNothing")}
          </p>
        ) : (
          <RowList>
            {queue.map((item) => (
              <Row
                key={item.key}
                href={item.href}
                urgent={item.urgent}
                kind={t(`teacher.queueKinds.${item.kind}`)}
                title={item.title}
                trailing={
                  item.kind === "draft" ? undefined : (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {item.detail}
                    </span>
                  )
                }
                detail={item.kind === "draft" ? item.detail : undefined}
              />
            ))}
          </RowList>
        )}
      </section>

      <section className="mb-10">
        <SectionHeader label={t("teacher.activity")} count={activity.length || undefined} />
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("teacher.activityNothing")}</p>
        ) : (
          <RowList>
            {activity.map((item) => (
              <Row
                key={item.key}
                href={item.href}
                kind={t(`teacher.activityKinds.${item.kind}`)}
                title={item.title}
                detail={item.detail}
                trailing={
                  <span className="meta shrink-0">
                    {format.dateTime(new Date(item.at), { day: "numeric", month: "short" })}
                  </span>
                }
              />
            ))}
          </RowList>
        )}
      </section>

      <section>
        <SectionHeader label={t("teacher.title")} count={classes.length || undefined} />
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("teacher.noClasses")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {classes.map((row) => {
              const cls = row.class!;
              const summary = summaries.get(cls.id) ?? { posts: 0, homework: 0 };
              return (
                <Link key={cls.id} href={`/classes/${cls.id}`} className="block">
                  <Card className="h-full transition-colors hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_16%)] hover:bg-muted/50">
                    <CardHeader>
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <Badge variant="secondary">{cls.level?.code}</Badge>
                        <Badge variant="outline">
                          {tFamily(`teacherRole.${row.role}`)}
                          {row.subject ? ` · ${row.subject}` : ""}
                        </Badge>
                      </div>
                      <CardTitle>{cls.name}</CardTitle>
                      <CardDescription>
                        {/* the label prefixed "Salle" onto a room already named
                          "Salle 1", which read "Salle Salle 1" */}
                        {cls.room ? cls.room : levelLabel(cls.level, locale)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span>
                        {t("teacher.students", { count: cls.enrollments[0]?.count ?? 0 })}
                      </span>
                      <span>
                        {tWeek("summary", { posts: summary.posts, homework: summary.homework })}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </Column>
  );
}
