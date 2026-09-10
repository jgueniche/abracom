import {
  CalendarPlusIcon,
  ClipboardListIcon,
  FilePlusIcon,
  MegaphoneIcon,
  SchoolIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { HubCard, HubGrid } from "@/components/domain/hub-card";
import { NewHomeworkButton } from "@/components/domain/new-homework-button";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { getMyTeachingClasses } from "@/server/queries/classes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publish");
  return { title: t("title") };
}

/**
 * Publishing is a teacher's daily loop, and it was buried in the header of a
 * class page. This is the one place that answers "what do I want to publish?"
 * — a single class goes straight through to its composer.
 *
 * Everything here writes. "Devoirs" used to be a card of this grid pointing at
 * `/devoirs`, the diary — a reading screen, in a hub where every other card
 * opens a composer. Setting homework is now the header action, which already
 * knows how to ask which class when a teacher has several.
 */
export default async function PublishPage() {
  const user = await requireCurrentUser();
  const [t, teaching] = await Promise.all([
    getTranslations("publish"),
    getMyTeachingClasses(user.id),
  ]);
  const staff = user.school ? isSchoolStaff(user.roles, user.school.id) : false;
  const classes = teaching.flatMap((row) => (row.class ? [row.class] : []));

  // Nothing to publish and no class to publish in: the page answered by URL
  // with an empty hub.
  if (!staff && classes.length === 0) redirect("/accueil");
  if (!staff && classes.length === 1) redirect(`/classes/${classes[0]!.id}/publier`);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <NewHomeworkButton
            classes={classes.map((cls) => ({ id: cls.id, name: cls.name }))}
            variant={staff ? "outline" : "default"}
          />
        }
      />
      <HubGrid>
        {classes.map((cls) => (
          <HubCard
            key={cls.id}
            href={`/classes/${cls.id}/publier`}
            icon={SchoolIcon}
            title={cls.name}
            hint={t("classSpaceHint")}
          />
        ))}
        {staff && (
          <>
            <HubCard
              href="/admin/annonces/nouvelle"
              icon={MegaphoneIcon}
              title={t("announcement")}
              hint={t("announcementHint")}
            />
            <HubCard
              href="/admin/documents"
              icon={FilePlusIcon}
              title={t("document")}
              hint={t("documentHint")}
            />
            <HubCard
              href="/agenda/nouveau"
              icon={CalendarPlusIcon}
              title={t("event")}
              hint={t("eventHint")}
            />
            <HubCard
              href="/admin/formulaires/nouveau"
              icon={ClipboardListIcon}
              title={t("form")}
              hint={t("formHint")}
            />
          </>
        )}
      </HubGrid>
    </>
  );
}
