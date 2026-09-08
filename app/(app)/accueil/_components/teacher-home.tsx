import { BookOpenIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth/session";

import { UpcomingEvents } from "@/app/(app)/agenda/_components/upcoming-events";
import { getWeeklySummary } from "@/server/queries/class-space";
import { getMyTeachingClasses } from "@/server/queries/classes";

export async function TeacherHome({ user }: { user: CurrentUser }) {
  const [t, tFamily, tWeek, classes] = await Promise.all([
    getTranslations("appHome"),
    getTranslations("family"),
    getTranslations("classSpace.week"),
    getMyTeachingClasses(user.id),
  ]);
  const summaries = await getWeeklySummary(classes.map((row) => row.class!.id));

  return (
    <>
      <PageHeader
        title={t("greeting", { name: user.profile.first_name })}
        description={t("teacher.title")}
      />
      {classes.length === 0 ? (
        <p className="text-muted-foreground">{t("teacher.noClasses")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((row) => {
            const cls = row.class!;
            const summary = summaries.get(cls.id) ?? { posts: 0, homework: 0 };
            return (
              <Link key={cls.id} href={`/classes/${cls.id}`} className="block">
                <Card className="h-full shadow-soft hover:bg-accent/40">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{cls.level?.code}</Badge>
                      <Badge variant="outline">
                        {tFamily(`teacherRole.${row.role}`)}
                        {row.subject ? ` · ${row.subject}` : ""}
                      </Badge>
                    </div>
                    <CardTitle>{cls.name}</CardTitle>
                    <CardDescription>
                      {cls.room ? t("teacher.room", { room: cls.room }) : cls.level?.label_fr}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <UsersIcon className="size-4" aria-hidden />
                      {t("teacher.students", { count: cls.enrollments[0]?.count ?? 0 })}
                    </span>
                    <span className="flex items-center gap-2">
                      <BookOpenIcon className="size-4" aria-hidden />
                      {tWeek("summary", { posts: summary.posts, homework: summary.homework })}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <UpcomingEvents userId={user.id} />
    </>
  );
}
