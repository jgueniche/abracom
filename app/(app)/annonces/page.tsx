import { CheckCircle2Icon, PinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { requireCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
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

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {announcements.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => {
            const title = locale === "en" && a.title_en ? a.title_en : a.title;
            const needsAck = a.requires_ack && !a.isAcked;
            return (
              <li key={a.id}>
                <Link
                  href={`/annonces/${a.id}`}
                  className={cn(
                    "block rounded-2xl border p-4 hover:bg-accent/60",
                    !a.isRead && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {a.pinned && (
                      <Badge variant="secondary">
                        <PinIcon aria-hidden />
                        {t("pinned")}
                      </Badge>
                    )}
                    {needsAck && <Badge>{t("requiresAck")}</Badge>}
                    {a.requires_ack && a.isAcked && (
                      <Badge variant="outline">
                        <CheckCircle2Icon aria-hidden />
                        {t("acked")}
                      </Badge>
                    )}
                    {!a.isRead && <Badge variant="destructive">{t("unread")}</Badge>}
                  </div>
                  <p className="font-heading text-lg font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.published_at &&
                      t("publishedOn", {
                        date: format.dateTime(new Date(a.published_at), { dateStyle: "long" }),
                      })}
                    {a.author
                      ? ` · ${t("by", { name: `${a.author.first_name} ${a.author.last_name}` })}`
                      : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
