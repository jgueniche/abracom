import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireSchoolRole } from "@/lib/auth/guards";
import { getEventAudienceOptions } from "@/server/queries/agenda";

import { EventForm } from "../_components/event-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agenda.form");
  return { title: t("newTitle") };
}

export default async function NewEventPage() {
  const { user, schoolId } = await requireSchoolRole(["school_admin", "staff", "teacher"]);
  const [t, ta, locale, options] = await Promise.all([
    getTranslations("agenda.form"),
    getTranslations("agenda"),
    getLocale(),
    getEventAudienceOptions(user, schoolId),
  ]);
  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/agenda">
          <ArrowLeftIcon aria-hidden />
          {ta("back")}
        </Link>
      </Button>
      <PageHeader title={t("newTitle")} />
      <EventForm options={options} locale={locale} />
    </Column>
  );
}
