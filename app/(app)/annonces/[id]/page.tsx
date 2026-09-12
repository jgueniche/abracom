import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/domain/markdown";
import { Column } from "@/components/layouts/column";
import { HelpHint } from "@/components/layouts/help-hint";
import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
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

  const dateline = [
    announcement.author
      ? t("by", { name: `${announcement.author.first_name} ${announcement.author.last_name}` })
      : null,
    announcement.published_at
      ? format.dateTime(new Date(announcement.published_at), { dateStyle: "long" })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /*
   * A circular is a letter, so it is set as one: a dateline, a title, a rule,
   * and the text at a width a person can actually read. It used to be a
   * markdown block inside a card, beside a column of three more cards, across
   * 1760 px — the composition of a dashboard, applied to the one screen in the
   * application whose whole job is to be read.
   *
   * What the letter *asks* of the reader — the receipt, the attachments — is
   * apparatus: it sits beside the text on a wide screen and under it on a
   * narrow one, and it never interrupts the reading.
   */
  const apparatus = (
    <div className="flex flex-col gap-6">
      {announcement.requires_ack && (
        <section>
          <SectionHeader label={t("ackTitle")} />
          {announcement.isAcked ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {t("ackedOn", {
                date: format.dateTime(new Date(announcement.myRead!.acked_at!), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
          ) : (
            <>
              <p className="text-sm text-pretty text-muted-foreground">{t("ackHint")}</p>
              <form action={acknowledgeAnnouncement} className="mt-3">
                <input type="hidden" name="announcementId" value={announcement.id} />
                <Button type="submit" size="lg" className="w-full">
                  <CheckIcon aria-hidden />
                  {t("ack")}
                </Button>
              </form>
            </>
          )}
        </section>
      )}
      {(attachments.length > 0 || linkedDocument) && (
        <section>
          <SectionHeader
            label={t("attachments")}
            count={attachments.length + (linkedDocument ? 1 : 0)}
          />
          <ul className="flex flex-col">
            {linkedDocument && (
              <li className="border-b border-rule last:border-b-0">
                <Link
                  href="/documents"
                  className="-mx-2 block rounded-md px-2 py-2 text-sm underline decoration-primary/35 underline-offset-[3px] transition-colors hover:bg-muted/50 hover:decoration-primary"
                >
                  {linkedDocument.title}
                </Link>
              </li>
            )}
            {attachments.map((file) => (
              <li key={file.id} className="border-b border-rule last:border-b-0">
                {file.url ? (
                  <a
                    href={file.url}
                    className="-mx-2 block rounded-md px-2 py-2 text-sm break-words underline decoration-primary/35 underline-offset-[3px] transition-colors hover:bg-muted/50 hover:decoration-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {file.filename}
                  </a>
                ) : (
                  <span className="block px-0 py-2 text-sm break-words text-muted-foreground">
                    {file.filename}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  return (
    <Column width="text" rail={apparatus}>
      <MarkRead id={announcement.id} alreadyRead={announcement.isRead} />
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-2.5">
        <Link href="/annonces">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <article>
        <header className="mb-7 border-b border-rule pb-5">
          {dateline && <p className="eyebrow mb-2">{dateline}</p>}
          <div className="flex items-start gap-1.5">
            <h1>{title}</h1>
            <HelpHint />
          </div>
          {announcement.expires_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("expiresOn", {
                date: format.dateTime(new Date(announcement.expires_at), { dateStyle: "medium" }),
              })}
            </p>
          )}
        </header>
        <Markdown>{body}</Markdown>
      </article>
    </Column>
  );
}
