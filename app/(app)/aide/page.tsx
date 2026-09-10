import { BookOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HubCard, HubGrid } from "@/components/domain/hub-card";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { type GuideSlug, GUIDE_SLUGS } from "@/lib/guides";
import { isSchoolAdmin, isSchoolStaff } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title") };
}

/** The guide that answers this reader's questions comes first. */
function guidesFor(user: { roles: Parameters<typeof isSchoolStaff>[0]; schoolId?: string }) {
  const { roles, schoolId } = user;
  if (!schoolId) return GUIDE_SLUGS;
  const mine: GuideSlug = isSchoolAdmin(roles, schoolId)
    ? "direction"
    : isSchoolStaff(roles, schoolId)
      ? "direction"
      : roles.some((r) => r.role === "teacher" && r.status === "active")
        ? "enseignants"
        : "parents";
  return [mine, ...GUIDE_SLUGS.filter((slug) => slug !== mine)];
}

export default async function HelpPage() {
  const user = await requireCurrentUser();
  const t = await getTranslations("help");
  const guides = guidesFor({ roles: user.roles, schoolId: user.school?.id });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {/* Three hand-rolled cards, a fourth shape for the same object; the hub
          card of `/ecole` and `/publier` is the one the design system carries. */}
      <HubGrid>
        {guides.map((slug) => (
          <HubCard
            key={slug}
            href={`/aide/${slug}`}
            icon={BookOpenIcon}
            title={t(`guides.${slug}.title`)}
            hint={t(`guides.${slug}.hint`)}
          />
        ))}
      </HubGrid>
      <p className="mt-6 text-sm text-muted-foreground">{t("languageNote")}</p>
    </>
  );
}
