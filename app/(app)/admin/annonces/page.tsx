import { ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { getAdminAnnouncements } from "@/server/queries/announcements";

export default async function AdminAnnouncementsPage() {
  const { schoolId } = await requireSchoolStaff();
  const [t, format, announcements] = await Promise.all([
    getTranslations("adminAnnouncements"),
    getFormatter(),
    getAdminAnnouncements(schoolId),
  ]);
  const variant = {
    draft: "outline",
    scheduled: "secondary",
    published: "default",
    expired: "outline",
  } as const;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild className="min-h-11">
            <Link href="/admin/annonces/nouvelle">
              <PlusIcon aria-hidden />
              {t("new")}
            </Link>
          </Button>
        }
      />
      <ul className="flex flex-col gap-2">
        {announcements.map((a) => (
          <li key={a.id}>
            <Link
              href={`/admin/annonces/${a.id}`}
              className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition-colors hover:bg-muted/50"
            >
              <Badge variant={variant[a.status]}>{t(`status.${a.status}`)}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">
                  {a.published_at
                    ? format.dateTime(new Date(a.published_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                  {a.requires_ack ? ` · ${t("fields.requiresAck")}` : ""}
                  {/* The total is only known per announcement (RLS-scoped
                      recipients), and printing "80 / ?" told nobody anything.
                      The real ratio lives on the announcement's own page. */}
                  {` · ${t("readsCount", { count: a.reads.length })}`}
                  {a.requires_ack
                    ? ` · ${t("ackedShort", { count: a.reads.filter((r) => r.acked_at).length })}`
                    : ""}
                </p>
              </div>
              <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
