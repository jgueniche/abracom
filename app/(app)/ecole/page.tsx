import {
  CalendarDaysIcon,
  ClipboardListIcon,
  FolderIcon,
  MegaphoneIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HubCard, HubGrid } from "@/components/domain/hub-card";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { getPendingAcknowledgements } from "@/server/queries/announcements";
import { getForms } from "@/server/queries/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("schoolHub");
  return { title: t("title") };
}

/**
 * Everything the school sends or asks for, in one tab.
 *
 * Announcements and circulars — the first product objective, the one that
 * carries the read receipt — had no navigation entry at all: they lived in a
 * card titled "My account" under "More", next to the sign-out button.
 */
export default async function SchoolPage() {
  const user = await requireCurrentUser();
  const [t, pending, forms] = await Promise.all([
    getTranslations("schoolHub"),
    getPendingAcknowledgements(user.id),
    getForms(),
  ]);
  /*
   * `form.responses` carries every response the reader is allowed to see, so
   * for the team — who see them all — a form nobody had answered yet counted as
   * "à remplir" and a form with one answer counted as done. The figure is a
   * family fact: it counts the forms *this reader* has not answered, and it is
   * only shown to someone the forms are addressed to.
   */
  const isFamily = user.perspective === "parent";
  const toAnswer = isFamily
    ? forms.filter((form) => !form.responses.some((r) => r.user_id === user.id)).length
    : 0;

  return (
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {/* Ordered by how often a family opens each one, not by the order the
          features were built: the agenda is consulted every week, a form two or
          three times a year. */}
      <HubGrid>
        <HubCard
          href="/annonces"
          icon={MegaphoneIcon}
          title={t("announcements")}
          hint={t("announcementsHint")}
          meta={pending.length > 0 ? t("pendingAck", { count: pending.length }) : undefined}
          urgent={pending.length > 0}
        />
        <HubCard
          href="/agenda"
          icon={CalendarDaysIcon}
          title={t("agenda")}
          hint={t("agendaHint")}
        />
        <HubCard
          href="/documents"
          icon={FolderIcon}
          title={t("documents")}
          hint={t("documentsHint")}
        />
        <HubCard
          href="/communaute/formulaires"
          icon={ClipboardListIcon}
          title={t("forms")}
          hint={t("formsHint")}
          // a bare digit where the card beside it writes a sentence
          meta={toAnswer > 0 ? t("formsToAnswer", { count: toAnswer }) : undefined}
          urgent={toAnswer > 0}
        />
        <HubCard
          href="/communaute"
          icon={UsersIcon}
          title={t("community")}
          hint={t("communityHint")}
        />
      </HubGrid>
    </Column>
  );
}
