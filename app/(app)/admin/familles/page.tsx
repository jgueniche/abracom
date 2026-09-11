import { ChevronRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
          <SectionHeader label={t("title")} count={students.length} className="mt-1" />
          {/* A register is tabular: sixty-six pupils were sixty-six bordered
              cards stacked in a third of the window, so nothing could be read
              down a column. */}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("columnPupil")}</TableHead>
                <TableHead>{t("columnClass")}</TableHead>
                <TableHead>{t("columnGuardians")}</TableHead>
                <TableHead className="w-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/familles/${s.id}`}
                      className="after:absolute after:inset-0 hover:underline hover:underline-offset-[3px]"
                    >
                      {s.last_name.toUpperCase()} {s.first_name}
                    </Link>
                    {s.status !== "active" && (
                      <Badge variant="outline" className="ml-2">
                        {t(`statuses.${s.status}`)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {s.currentClass?.name ?? t("noClass")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.student_guardians
                      .filter((g) => g.profile)
                      .map(
                        (g) =>
                          `${g.profile!.first_name} ${g.profile!.last_name}${g.access_blocked ? ` (${t("blockedShort")})` : ""}`,
                      )
                      .join(", ") || t("noGuardians")}
                  </TableCell>
                  <TableCell>
                    <ChevronRightIcon className="size-3.5 text-muted-foreground/50" aria-hidden />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
