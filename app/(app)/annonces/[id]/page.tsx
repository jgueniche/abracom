import { ArrowLeftIcon, CheckIcon, FileTextIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/domain/markdown";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { BUCKETS, createSignedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { acknowledgeAnnouncement } from "@/server/actions/announcements";
import { getAnnouncement } from "@/server/queries/announcements";

import { MarkRead } from "./mark-read";

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [t, format, locale, announcement, supabase] = await Promise.all([
    getTranslations("announcements"),
    getFormatter(),
    getLocale(),
    getAnnouncement(user.id, id),
    createClient(),
  ]);
  if (!announcement) notFound();

  const title =
    locale === "en" && announcement.title_en ? announcement.title_en : announcement.title;
  const body =
    locale === "en" && announcement.body_md_en ? announcement.body_md_en : announcement.body_md;
  const attachments = await Promise.all(
    announcement.attachments.map(async (file) => ({
      ...file,
      url: await createSignedUrl(supabase, BUCKETS.attachments, file.storage_path, file.filename),
    })),
  );
  const linkedDocument = announcement.document_id
    ? (
        await supabase
          .from("documents")
          .select("id, title")
          .eq("id", announcement.document_id)
          .maybeSingle()
      ).data
    : null;

  return (
    <>
      <MarkRead id={announcement.id} alreadyRead={announcement.isRead} />
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/annonces">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={title}
        description={[
          announcement.published_at
            ? t("publishedOn", {
                date: format.dateTime(new Date(announcement.published_at), { dateStyle: "long" }),
              })
            : null,
          announcement.author
            ? t("by", {
                name: `${announcement.author.first_name} ${announcement.author.last_name}`,
              })
            : null,
          announcement.expires_at
            ? t("expiresOn", {
                date: format.dateTime(new Date(announcement.expires_at), { dateStyle: "medium" }),
              })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent>
            <Markdown>{body}</Markdown>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          {announcement.requires_ack && (
            <Card className={announcement.isAcked ? "bg-muted/40" : "border-primary"}>
              <CardContent className="flex flex-col gap-3">
                {announcement.isAcked ? (
                  <Badge variant="secondary" className="w-fit">
                    <CheckIcon aria-hidden />
                    {t("ackedOn", {
                      date: format.dateTime(new Date(announcement.myRead!.acked_at!), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })}
                  </Badge>
                ) : (
                  <>
                    <p className="text-sm">{t("ackHint")}</p>
                    <form action={acknowledgeAnnouncement}>
                      <input type="hidden" name="announcementId" value={announcement.id} />
                      <Button type="submit" className="min-h-11 w-full">
                        <CheckIcon aria-hidden />
                        {t("ack")}
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {linkedDocument && (
            <Button asChild variant="secondary" className="min-h-11 justify-start">
              <Link href="/documents">
                <FileTextIcon aria-hidden />
                {t("attachedDocument", { title: linkedDocument.title })}
              </Link>
            </Button>
          )}
          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("attachments")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {attachments.map((file) => (
                    <li key={file.id}>
                      {file.url ? (
                        <a
                          href={file.url}
                          className="flex min-h-11 items-center gap-2 text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <PaperclipIcon className="size-4" aria-hidden />
                          {file.filename}
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <PaperclipIcon className="size-4" aria-hidden />
                          {file.filename}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
