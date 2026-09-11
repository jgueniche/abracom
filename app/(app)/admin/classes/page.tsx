import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";
import { getAdminClasses, getLevels } from "@/server/queries/admin";

import { ClassForm } from "./class-form";

export default async function ClassesPage() {
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tFamily, locale, classes, levels] = await Promise.all([
    getTranslations("admin.classes"),
    getTranslations("family"),
    getLocale(),
    getAdminClasses(schoolId),
    getLevels(schoolId),
  ]);
  const admin = isSchoolAdmin(user.roles, schoolId);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <ul className="flex flex-col gap-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/classes/${c.id}`}
                className="flex items-center gap-4 rounded-xl border p-4 hover:bg-muted/60"
              >
                <Badge variant="secondary">{c.level?.code}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {c.name} {c.archived && <Badge variant="outline">{t("archived")}</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {t("students", { count: c.enrollments[0]?.count ?? 0 })}
                    {c.room ? ` · ${c.room}` : ""}
                    {" · "}
                    {c.class_teachers
                      .filter((ct) => ct.profile && ct.role === "main")
                      .map((ct) => `${ct.profile!.first_name} ${ct.profile!.last_name}`)
                      .join(", ") || tFamily("teacherRole.main")}
                  </p>
                </div>
                <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        {admin && (
          <Card className="self-start">
            <CardHeader>
              <CardTitle>{t("create")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ClassForm
                levels={levels.map((l) => ({
                  id: l.id,
                  code: l.code,
                  label: locale === "en" ? l.label_en : l.label_fr,
                }))}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
