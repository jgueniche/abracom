import { UsersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth/session";
import { getMyTeachingClasses } from "@/server/queries/classes";

export async function TeacherHome({ user }: { user: CurrentUser }) {
  const t = await getTranslations("appHome");
  const tFamily = await getTranslations("family");
  const classes = await getMyTeachingClasses(user.id);

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
          {classes.map((row) => (
            <Card key={row.class!.id} className="shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{row.class!.level?.code}</Badge>
                  <Badge variant="outline">
                    {tFamily(`teacherRole.${row.role}`)}
                    {row.subject ? ` · ${row.subject}` : ""}
                  </Badge>
                </div>
                <CardTitle>{row.class!.name}</CardTitle>
                <CardDescription>
                  {row.class!.room
                    ? t("teacher.room", { room: row.class!.room })
                    : row.class!.level?.label_fr}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersIcon className="size-4" aria-hidden />
                {t("teacher.students", { count: row.class!.enrollments[0]?.count ?? 0 })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
