import { MegaphoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { EyebrowDot } from "@/components/domain/content-card";
import { EmptyState } from "@/components/domain/empty-state";
import { IndexEntry, IndexList } from "@/components/domain/index-entry";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
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

  const pinned = announcements.filter((a) => a.pinned);
  const rest = announcements.filter((a) => !a.pinned);

  const entry = (a: (typeof announcements)[number]) => {
    const title = locale === "en" && a.title_en ? a.title_en : a.title;
    const body = locale === "en" && a.body_md_en ? a.body_md_en : a.body_md;
    const needsAck = a.requires_ack && !a.isAcked;
    return (
      <IndexEntry
        key={a.id}
        href={`/annonces/${a.id}`}
        // Red used to mean "unread", so a routine notice arrived looking like
        // an alert. It is now reserved for the one thing that genuinely needs
        // the reader: a receipt still to give.
        accent={needsAck}
        unread={!a.isRead}
        eyebrow={
          <>
            {a.author ? `${a.author.first_name} ${a.author.last_name}` : t("by", { name: "" })}
            {a.published_at && (
              <>
                <EyebrowDot />
                {format.dateTime(new Date(a.published_at), { dateStyle: "medium" })}
              </>
            )}
          </>
        }
        marker={
          needsAck ? (
            <span className="text-brick">{t("requiresAck")}</span>
          ) : a.requires_ack && a.isAcked ? (
            <span className="text-success">{t("acked")}</span>
          ) : undefined
        }
        title={title}
        excerpt={plainExcerpt(body, 140)}
      />
    );
  };

  return (
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {announcements.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title={t("empty")}
          description={t("emptyHint")}
          action={canPublish ? { href: "/admin/annonces/nouvelle", label: t("write") } : undefined}
        />
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="mb-10">
              <SectionHeader label={t("pinnedSection")} count={pinned.length} />
              <IndexList>{pinned.map(entry)}</IndexList>
            </section>
          )}
          <section>
            {pinned.length > 0 && <SectionHeader label={t("allOthers")} count={rest.length} />}
            <IndexList>{rest.map(entry)}</IndexList>
          </section>
        </>
      )}
    </Column>
  );
}
