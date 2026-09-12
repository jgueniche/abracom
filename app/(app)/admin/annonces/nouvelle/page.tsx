import { getLocale, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { getAudienceOptions } from "@/server/queries/announcements";

import { AnnouncementForm } from "../announcement-form";

export default async function NewAnnouncementPage() {
  const { schoolId } = await requireSchoolStaff();
  const [t, locale, options] = await Promise.all([
    getTranslations("adminAnnouncements"),
    getLocale(),
    getAudienceOptions(schoolId),
  ]);
  return (
    <Column width="text">
      <PageHeader title={t("new")} />
      <Card>
        <CardContent>
          <AnnouncementForm options={options} documents={options.documents} locale={locale} />
        </CardContent>
      </Card>
    </Column>
  );
}
