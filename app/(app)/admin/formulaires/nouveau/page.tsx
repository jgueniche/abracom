import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { getAudienceOptions } from "@/server/queries/announcements";

import { FormBuilder } from "../form-builder";

export default async function NewFormPage() {
  const { schoolId } = await requireSchoolStaff();
  const [t, locale, options] = await Promise.all([
    getTranslations("community.admin"),
    getLocale(),
    getAudienceOptions(schoolId),
  ]);
  return (
    <>
      <PageHeader title={t("newForm")} />
      <FormBuilder
        options={{ levels: options.levels, classes: options.classes, users: options.users }}
        locale={locale}
      />
    </>
  );
}
