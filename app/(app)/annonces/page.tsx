import { CheckCircle2Icon, MegaphoneIcon, PinIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { ContentCard, EyebrowDot, MetaChip } from "@/components/domain/content-card";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { plainExcerpt } from "@/lib/text";
import { getAnnouncementsForUser } from "@/server/queries/announcements";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("announcements");
  return { title: t("title") };
}

export default async function AnnouncementsPage() {
  const user = await requireCurrentUser();
  const [t, format, locale, announcements] = await Promise.all([
    getTranslations("announcements"),
    getFormatter(),
    getLocale(),
    getAnnouncementsForUser(user.id),
  ]);
  const canPublish = user.school ? isSchoolStaff(user.roles, user.school.id) : false;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {announcements.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title={t("empty")}
          description={t("emptyHint")}
          action={canPublish ? { href: "/admin/annonces/nouvelle", label: t("write") } : undefined}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {announcements.map((a) => {
            const title = locale === "en" && a.title_en ? a.title_en : a.title;
            const body = locale === "en" && a.body_md_en ? a.body_md_en : a.body_md;
            const needsAck = a.requires_ack && !a.isAcked;
            return (
              <li key={a.id}>
                <ContentCard
                  href={`/annonces/${a.id}`}
                  // Red used to mean "unread", so a routine notice arrived
                  // looking like an alert. It is now reserved for the one thing
                  // that genuinely needs the reader: a receipt still to give.
                  accent={needsAck}
                  unread={!a.isRead}
                  eyebrow={
                    <>
                      {a.pinned && (
                        <>
                          <PinIcon className="size-3.5" aria-hidden />
                          {t("pinned")}
                          <EyebrowDot />
                        </>
                      )}
                      {a.author
                        ? `${a.author.first_name} ${a.author.last_name}`
                        : t("by", { name: "" })}
                      {a.published_at && (
                        <>
                          <EyebrowDot />
                          {format.dateTime(new Date(a.published_at), { dateStyle: "medium" })}
                        </>
                      )}
                    </>
                  }
                  title={title}
                  excerpt={plainExcerpt(body, 190)}
                  footer={
                    needsAck || (a.requires_ack && a.isAcked) ? (
                      <>
                        {needsAck && <MetaChip tone="brick">{t("requiresAck")}</MetaChip>}
                        {a.requires_ack && a.isAcked && (
                          <MetaChip tone="success">
                            <CheckCircle2Icon className="size-3.5" aria-hidden />
                            {t("acked")}
                          </MetaChip>
                        )}
                      </>
                    ) : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
