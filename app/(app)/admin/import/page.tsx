import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { requireSchoolAdmin } from "@/lib/auth/guards";

import { ImportWizard } from "./import-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.import");
  return { title: t("title") };
}

export default async function ImportPage() {
  await requireSchoolAdmin();
  const t = await getTranslations("admin.import");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ImportWizard />
    </>
  );
}
