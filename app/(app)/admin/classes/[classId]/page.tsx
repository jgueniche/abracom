import { ArrowLeftIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { levelLabel } from "@/lib/levels";
import { isSchoolAdmin } from "@/lib/permissions";
import { removeTeacher } from "@/server/actions/admin/classes";
import { getClassDetail, getLevels, getTeachers } from "@/server/queries/admin";

import { ClassForm } from "../class-form";
import { AssignTeacherForm } from "./assign-teacher-form";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tFamily, tStudents, locale, cls, levels, teachers] = await Promise.all([
    getTranslations("admin.classes"),
    getTranslations("family"),
    getTranslations("admin.students"),
    getLocale(),
    getClassDetail(schoolId, classId),
    getLevels(schoolId),
    getTeachers(schoolId),
  ]);
  if (!cls) notFound();
  const admin = isSchoolAdmin(user.roles, schoolId);

  return (
    <Column width="full">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/classes">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={cls.name}
        description={`${cls.level?.code ?? ""} · ${levelLabel(cls.level, locale)}`}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("team")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {cls.class_teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noTeachers")}</p>
            ) : (
              <ul className="divide-y">
                {cls.class_teachers.map((ct) => (
                  <li key={ct.user_id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium">
                        {ct.profile
                          ? `${ct.profile.first_name} ${ct.profile.last_name}`
                          : ct.user_id}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {tFamily(`teacherRole.${ct.role}`)}
                        {ct.subject ? ` · ${ct.subject}` : ""}
                      </p>
                    </div>
                    {admin && (
                      <form action={removeTeacher}>
                        <input type="hidden" name="classId" value={cls.id} />
                        <input type="hidden" name="userId" value={ct.user_id} />
                        <Button type="submit" variant="ghost" size="icon" aria-label={t("remove")}>
                          <XIcon />
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {admin && (
              <AssignTeacherForm
                classId={cls.id}
                teachers={teachers.map((m) => ({
                  id: m.user_id,
                  name: `${m.profile!.first_name} ${m.profile!.last_name}`,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("roster")}{" "}
              <Badge variant="secondary" className="ml-2">
                {cls.enrollments.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cls.enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
            ) : (
              <ul className="divide-y">
                {cls.enrollments.map((e) => (
                  <li key={e.id} className="py-2">
                    <Link
                      href={`/admin/familles/${e.student!.id}`}
                      className="flex items-center justify-between hover:text-primary"
                    >
                      <span>
                        {e.student!.last_name.toUpperCase()} {e.student!.first_name}
                      </span>
                      {e.student!.status !== "active" && (
                        <Badge variant="outline">
                          {tStudents(`statuses.${e.student!.status}`)}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {admin && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("edit")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ClassForm
                levels={levels.map((l) => ({
                  id: l.id,
                  code: l.code,
                  label: locale === "en" ? l.label_en : l.label_fr,
                }))}
                initial={{
                  id: cls.id,
                  name: cls.name,
                  levelId: cls.level_id,
                  room: cls.room,
                  capacity: cls.capacity,
                  archived: cls.archived,
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </Column>
  );
}
