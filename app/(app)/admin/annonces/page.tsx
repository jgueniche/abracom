import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { IndexEntry, IndexList } from "@/components/domain/index-entry";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
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
  // A status is a fact about the entry, not a colour to repaint it with: ten
  // filled blue "Publiée" pills down a page say nothing, because they say the
  // same thing. Only what is *not yet out* — a draft, a scheduled item — is
  // marked, and it is marked in the margin.
  const pending = (status: string) => status === "draft" || status === "scheduled";
  // "Publiée" on every line of a list of published announcements is a word the
  // eye has to skip ten times to read the eleventh; the exceptions are named.

  return (
    <Column>
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
      <IndexList>
        {announcements.map((a) => (
          <IndexEntry
            key={a.id}
            href={`/admin/annonces/${a.id}`}
            accent={pending(a.status)}
            unread={pending(a.status)}
            eyebrow={
              a.published_at
                ? format.dateTime(new Date(a.published_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : t(`status.${a.status}`)
            }
            marker={a.status === "published" ? undefined : t(`status.${a.status}`)}
            title={a.title}
            excerpt={[
              a.requires_ack ? t("fields.requiresAck") : null,
              // The total is only known per announcement (RLS-scoped
              // recipients), and printing "80 / ?" told nobody anything. The
              // real ratio lives on the announcement's own page.
              t("readsCount", { count: a.reads.length }),
              a.requires_ack
                ? t("ackedShort", { count: a.reads.filter((r) => r.acked_at).length })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </IndexList>
    </Column>
  );
}
