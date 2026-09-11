import { CheckIcon, GraduationCapIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";
import { setCurrentSchoolYear } from "@/server/actions/admin/school-years";
import { getSchoolYears } from "@/server/queries/admin";

import { YearForm } from "./year-form";

export default async function YearsPage() {
  const { user, schoolId } = await requireSchoolStaff();
  const [t, format, years] = await Promise.all([
    getTranslations("admin.years"),
    getFormatter(),
    getSchoolYears(schoolId),
  ]);
  const admin = isSchoolAdmin(user.roles, schoolId);
  const latest = years[0]?.label ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const [a] = latest.split("-");
  const suggested = `${Number(a) + 1}-${Number(a) + 2}`;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          admin ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/admin/annees/promotion">
                <GraduationCapIcon aria-hidden />
                {t("promotion")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardContent>
            {years.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("none")}</p>
            ) : (
              <ul className="divide-y">
                {years.map((year) => (
                  <li
                    key={year.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {year.label}{" "}
                        {year.is_current && <Badge className="ml-2">{t("current")}</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format.dateTime(new Date(year.starts_on), { dateStyle: "medium" })} →{" "}
                        {format.dateTime(new Date(year.ends_on), { dateStyle: "medium" })}
                      </p>
                    </div>
                    {admin && !year.is_current && (
                      <form action={setCurrentSchoolYear}>
                        <input type="hidden" name="yearId" value={year.id} />
                        <Button type="submit" variant="outline" size="sm" className="min-h-11">
                          <CheckIcon aria-hidden />
                          {t("setCurrent")}
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {admin && (
          <Card>
            <CardHeader>
              <CardTitle>{t("create")}</CardTitle>
            </CardHeader>
            <CardContent>
              <YearForm suggestedLabel={years.length ? suggested : latest} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
