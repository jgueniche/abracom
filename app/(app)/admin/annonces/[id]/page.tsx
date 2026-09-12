import { ArrowLeftIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollRegion } from "@/components/domain/scroll-region";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { deleteAnnouncement } from "@/server/actions/admin/announcements";
import {
  announcementStatus,
  getAnnouncement,
  getAnnouncementRecipients,
  getAudienceOptions,
} from "@/server/queries/announcements";

import { AnnouncementForm } from "../announcement-form";
import { Attachments } from "./attachments";
import { RemindButton } from "./remind-button";

export default async function AdminAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tRoles, format, locale, announcement, options] = await Promise.all([
    getTranslations("adminAnnouncements"),
    getTranslations("roles"),
    getFormatter(),
    getLocale(),
    getAnnouncement(user.id, id),
    getAudienceOptions(schoolId),
  ]);
  if (!announcement || announcement.deleted_at) notFound();
  const status = announcementStatus(announcement);
  const recipients = status === "draft" ? null : await getAnnouncementRecipients(id);
  const nonReaders =
    recipients?.rows.filter((r) =>
      announcement.requires_ack ? r.acked_at === null : r.read_at === null,
    ) ?? [];

  return (
    <Column width="full">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/annonces">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={announcement.title}
        description={t(`status.${status}`)}
        actions={
          <form action={deleteAnnouncement}>
            <input type="hidden" name="id" value={announcement.id} />
            <Button type="submit" variant="ghost" className="min-h-11 text-destructive">
              <Trash2Icon aria-hidden />
              {t("delete")}
            </Button>
          </form>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardContent>
            <AnnouncementForm
              options={options}
              documents={options.documents}
              locale={locale}
              initial={{
                id: announcement.id,
                title: announcement.title,
                bodyMd: announcement.body_md,
                titleEn: announcement.title_en,
                bodyMdEn: announcement.body_md_en,
                audience: announcement.audience,
                targetIds: announcement.target_ids,
                requiresAck: announcement.requires_ack,
                pinned: announcement.pinned,
                publishedAt: announcement.published_at,
                expiresAt: announcement.expires_at,
                documentId: announcement.document_id,
                template: announcement.template,
              }}
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          {recipients && (
            <Card>
              <CardHeader>
                <CardTitle>{t("reads")}</CardTitle>
                <CardDescription>
                  {t("recipients")} : {recipients.total} · {t("read")} : {recipients.read}
                  {announcement.requires_ack ? ` · ${t("ackedCount")} : ${recipients.acked}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <RemindButton
                    announcementId={announcement.id}
                    disabled={nonReaders.length === 0}
                  />
                  <Button asChild variant="outline" className="min-h-11">
                    <a href={`/admin/annonces/${announcement.id}/export`}>
                      <DownloadIcon aria-hidden />
                      {t("export")}
                    </a>
                  </Button>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">
                    {t("nonReaders")} <Badge variant="secondary">{nonReaders.length}</Badge>
                  </p>
                  {nonReaders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("allRead")}</p>
                  ) : (
                    <ScrollRegion
                      label={t("nonReaders")}
                      className="max-h-64 overflow-auto rounded-lg"
                    >
                      <ul className="text-sm text-muted-foreground">
                        {nonReaders.map((r) => (
                          <li key={r.user_id}>
                            {r.last_name} {r.first_name} · {tRoles(r.role)}
                          </li>
                        ))}
                      </ul>
                    </ScrollRegion>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("attachments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Attachments announcementId={announcement.id} files={announcement.attachments} />
            </CardContent>
          </Card>
          {announcement.published_at && (
            <p className="text-xs text-muted-foreground">
              {format.dateTime(new Date(announcement.published_at), {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
      </div>
    </Column>
  );
}
