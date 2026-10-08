import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { getAdminClasses } from "@/server/queries/admin";

import { FamilyForm } from "./family-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.families");
  return { title: t("title") };
}

/**
 * « Nouvelle famille » (ADR-0075): the e-mail a family sends — who the parents
 * are, which children, in which class — typed once, and the parents' sign-in
 * details handed back to give them. The direction's alone: it opens accounts.
 */
export default async function NewFamilyPage() {
  const { schoolId } = await requireSchoolAdmin();
  const [t, tStudents, classes] = await Promise.all([
    getTranslations("admin.families"),
    getTranslations("admin.students"),
    getAdminClasses(schoolId),
  ]);

  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/familles">
          <ArrowLeftIcon aria-hidden />
          {tStudents("back")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <FamilyForm
        classes={classes.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name }))}
      />
    </Column>
  );
}
