import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { getAdminEvents } from "@/server/queries/agenda";

export default async function AdminEventsPage() {
  const { user, schoolId } = await requireSchoolStaff();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [t, format, events] = await Promise.all([
    getTranslations("agenda"),
    getFormatter(),
    getAdminEvents(user.id, schoolId, weekAgo),
  ]);

  return (
    <Column>
      <PageHeader
        title={t("admin.title")}
        description={t("admin.subtitle")}
        actions={
          <Button asChild className="min-h-11">
            <Link href="/agenda/nouveau">
              <PlusIcon aria-hidden />
              {t("new")}
            </Link>
          </Button>
        }
      />
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("upcoming.empty")}</p>
      ) : (
        <RowList>
          {events.map((event) => (
            <Row
              key={event.id}
              href={`/agenda/${event.id}`}
              kind={t(`kinds.${event.kind}`)}
              title={event.title}
              detail={[
                format.dateTime(new Date(event.starts_at), {
                  dateStyle: "medium",
                  ...(event.all_day ? {} : { timeStyle: "short" }),
                }),
                event.requires_rsvp
                  ? t("admin.answers", {
                      yes: event.visibleCounts.yes,
                      maybe: event.visibleCounts.maybe,
                      no: event.visibleCounts.no,
                    })
                  : t("admin.noRsvp"),
                event.requires_rsvp && event.visibleCounts.waitlisted > 0
                  ? t("admin.waiting", { count: event.visibleCounts.waitlisted })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </RowList>
      )}
    </Column>
  );
}
