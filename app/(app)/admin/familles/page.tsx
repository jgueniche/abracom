import { ChevronRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { getAdminClasses, searchStudents } from "@/server/queries/admin";

import { StudentForm } from "./student-form";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { schoolId } = await requireSchoolStaff();
  const [t, students, classes] = await Promise.all([
    getTranslations("admin.students"),
    searchStudents(schoolId, q),
    getAdminClasses(schoolId),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <form className="flex gap-2" role="search">
            <Input
              name="q"
              defaultValue={q}
              placeholder={t("searchHint")}
              aria-label={t("search")}
              className="min-h-11"
            />
            <Button type="submit" variant="outline" className="min-h-11">
              <SearchIcon aria-hidden />
              {t("search")}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">{t("count", { count: students.length })}</p>
          <ul className="flex flex-col gap-2">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/familles/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {s.last_name.toUpperCase()} {s.first_name}
                      {s.status !== "active" && (
                        <Badge variant="outline" className="ml-2">
                          {t(`statuses.${s.status}`)}
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {s.currentClass?.name ?? t("noClass")}
                      {" · "}
                      {s.student_guardians
                        .filter((g) => g.profile)
                        .map(
                          (g) =>
                            `${g.profile!.first_name} ${g.profile!.last_name}${g.access_blocked ? ` (${t("blockedShort")})` : ""}`,
                        )
                        .join(", ") || t("noGuardians")}
                    </p>
                  </div>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>{t("new")}</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentForm
              classes={classes.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
