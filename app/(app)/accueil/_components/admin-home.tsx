import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth/session";
import { getSchoolClasses } from "@/server/queries/classes";
import { getSchoolStats } from "@/server/queries/school";

export async function AdminHome({ user }: { user: CurrentUser }) {
  const t = await getTranslations("appHome");
  const tFamily = await getTranslations("family");
  const schoolId = user.school?.id;
  if (!schoolId) return <PageHeader title={t("admin.title")} />;

  const [stats, classes] = await Promise.all([
    getSchoolStats(schoolId),
    getSchoolClasses(schoolId),
  ]);
  const tiles = [
    { label: t("admin.students"), value: stats.students },
    { label: t("admin.families"), value: stats.families },
    { label: t("admin.classes"), value: stats.classes },
  ];

  return (
    <>
      <PageHeader title={t("admin.title")} description={user.school?.name} />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{tile.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardDescription>{t("admin.activation")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
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

      <h2 className="mb-3 text-xl font-semibold">{t("admin.classesTitle")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
