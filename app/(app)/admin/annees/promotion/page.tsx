import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getLevels, getSchoolYears } from "@/server/queries/admin";

import { PromotionForm, type PromotionRow } from "./promotion-form";

export default async function PromotionPage() {
  const { schoolId } = await requireSchoolAdmin();
  const [t, ty, locale, years, levels, supabase] = await Promise.all([
    getTranslations("admin.promotion"),
    getTranslations("admin.years"),
    getLocale(),
    getSchoolYears(schoolId),
    getLevels(schoolId),
    createClient(),
  ]);
  const current = years.find((y) => y.is_current) ?? null;
  const next = current
    ? (years
        .filter((y) => y.starts_on > current.starts_on)
        .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null)
    : null;
  const sortedLevels = [...levels].sort((a, b) => a.sort_order - b.sort_order);
  const rows: PromotionRow[] = [];
  if (current) {
    const { data: classes } = await supabase
      .from("classes")
      .select(
        "id, name, level_id, archived, enrollments ( left_on ), level:levels ( code, sort_order )",
      )
      .eq("school_id", schoolId)
      .eq("school_year_id", current.id)
      .eq("archived", false)
      .order("name");
    for (const cls of classes ?? []) {
      const index = sortedLevels.findIndex((l) => l.id === cls.level_id);
      const nextLevel = index >= 0 ? (sortedLevels[index + 1] ?? null) : null;
      const code = cls.level?.code ?? "";
      const proposedName =
        nextLevel && code && cls.name.startsWith(code)
          ? `${nextLevel.code}${cls.name.slice(code.length)}`
          : cls.name;
      rows.push({
        classId: cls.id,
        name: cls.name,
        levelCode: code,
        students: cls.enrollments.filter((e) => e.left_on === null).length,
        proposedLevelId: nextLevel?.id ?? null,
        proposedName,
      });
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/annees">
          <ArrowLeftIcon aria-hidden />
          {ty("title")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardContent>
          {!current ? (
            <p className="text-sm text-muted-foreground">{t("noCurrent")}</p>
          ) : !next ? (
            <p className="text-sm text-muted-foreground">{t("noNext", { year: current.label })}</p>
          ) : (
            <>
              <p className="mb-4 text-sm">{t("fromTo", { from: current.label, to: next.label })}</p>
              <PromotionForm
                currentYearId={current.id}
                nextYearId={next.id}
                rows={rows}
                levels={sortedLevels}
                locale={locale}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
