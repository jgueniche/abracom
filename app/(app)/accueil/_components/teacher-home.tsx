import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { NewHomeworkButton } from "@/components/domain/new-homework-button";
import { AttendanceToday } from "@/components/domain/attendance-today";
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

export async function TeacherHome({ user }: { user: CurrentUser }) {
  const [t, tFamily, tWeek, format, locale, classes] = await Promise.all([
    getTranslations("appHome"),
    getTranslations("family"),
    getTranslations("classSpace.week"),
    getFormatter(),
    getLocale(),
    getMyTeachingClasses(user.id),
  ]);
  const summaries = await getWeeklySummary(classes.map((row) => row.class!.id));

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
                    <span>{t("teacher.students", { count: cls.enrollments[0]?.count ?? 0 })}</span>
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
    </Column>
  );
}
