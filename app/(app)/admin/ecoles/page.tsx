import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { requireSchoolRole } from "@/lib/auth/guards";
import { isTestSchool } from "@/lib/auth/school-choice";
import { createClient } from "@/lib/supabase/server";

import { OpenSchoolForm } from "./open-school-form";
import { TestPasswordForm } from "./test-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.schools");
  return { title: t("title") };
}

/**
 * The platform's page (ADR-0074): every school it holds, the way to open a new
 * one — Levallois, the day it comes — and the password of the test school's
 * door. Only the platform administrator reaches it; a school's direction
 * manages its own school, not the list of schools.
 */
export default async function SchoolsPage() {
  const { user } = await requireSchoolRole(["super_admin"]);
  const supabase = await createClient();
  const [t, format, { data: schools }] = await Promise.all([
    getTranslations("admin.schools"),
    getFormatter(),
    supabase.from("schools").select("id, name, city, modules, created_at").order("created_at"),
  ]);
  const mine = new Set(user.schools.map((school) => school.id));

  return (
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <section className="mb-10">
        <SectionHeader label={t("listLabel")} count={schools?.length ?? 0} />
        <RowList>
          {(schools ?? []).map((school) => (
            <Row
              key={school.id}
              title={school.name}
              detail={[
                school.city,
                isTestSchool(school) ? t("testBadge") : null,
                t("openedOn", {
                  date: format.dateTime(new Date(school.created_at), { dateStyle: "medium" }),
                }),
                mine.has(school.id) ? null : t("notMember"),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </RowList>
      </section>
      <section className="mb-10">
        <SectionHeader label={t("openLabel")} hint={t("openHint")} />
        <OpenSchoolForm />
      </section>
      <section>
        <SectionHeader label={t("testPasswordLabel")} hint={t("testPasswordHint")} />
        <TestPasswordForm />
      </section>
    </Column>
  );
}
