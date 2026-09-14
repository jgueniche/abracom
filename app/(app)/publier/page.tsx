import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { HubCard, HubGrid } from "@/components/domain/hub-card";
import { HubMenuCard } from "@/components/domain/hub-menu-card";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { getMyTeachingClasses } from "@/server/queries/classes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publish");
  return { title: t("title") };
}

/**
 * The one place that answers "what do I want to publish?".
 *
 * It used to answer a different question — *in which class?* — and then, for
 * the teacher of a single class, answer it by itself: the tab redirected
 * straight into that class's composer, so one of the five tabs in the bar led
 * nowhere of its own. What a teacher publishes is three different things (a
 * diary entry, a homework, a private note to one family), each reached today by
 * guessing a select inside a composer. They are the rows of this hub; the class
 * is asked only when there is more than one.
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

  const targets = [
    { key: "journal", href: (id: string) => `/classes/${id}/publier?type=journal` },
    { key: "homework", href: (id: string) => `/classes/${id}/publier?type=homework` },
    { key: "note", href: (id: string) => `/classes/${id}/mots` },
  ] as const;

  return (
    <Column width="index">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {classes.length > 0 && (
        <section className="flex flex-col">
          {staff && <SectionHeader label={t("classSpace")} />}
          <HubGrid>
            {targets.map((target) =>
              classes.length === 1 ? (
                <HubCard
                  key={target.key}
                  href={target.href(classes[0]!.id)}
                  title={t(target.key)}
                  hint={t(`${target.key}Hint`)}
                />
              ) : (
                <HubMenuCard
                  key={target.key}
                  title={t(target.key)}
                  hint={t(`${target.key}Hint`)}
                  classes={classes.map((cls) => ({ id: cls.id, name: cls.name }))}
                  href={target.href}
                />
              ),
            )}
          </HubGrid>
        </section>
      )}
      {staff && (
        <section className="mt-8 flex flex-col">
          {classes.length > 0 && <SectionHeader label={t("school")} />}
          <HubGrid>
            <HubCard
              href="/admin/annonces/nouvelle"
              title={t("announcement")}
              hint={t("announcementHint")}
            />
            <HubCard href="/admin/documents" title={t("document")} hint={t("documentHint")} />
            <HubCard href="/agenda/nouveau" title={t("event")} hint={t("eventHint")} />
            <HubCard href="/admin/formulaires/nouveau" title={t("form")} hint={t("formHint")} />
          </HubGrid>
        </section>
      )}
    </Column>
  );
}
