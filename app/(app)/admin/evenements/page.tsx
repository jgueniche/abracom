import { ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
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
    <>
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
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/agenda/${event.id}`}
                className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/60"
              >
                <Badge variant={event.kind === "holiday" ? "outline" : "secondary"}>
                  {t(`kinds.${event.kind}`)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(new Date(event.starts_at), {
                      dateStyle: "medium",
                      ...(event.all_day ? {} : { timeStyle: "short" }),
                    })}
                    {" · "}
                    {event.requires_rsvp
                      ? [
                          t("admin.answers", {
                            yes: event.visibleCounts.yes,
                            maybe: event.visibleCounts.maybe,
                            no: event.visibleCounts.no,
                          }),
                          event.visibleCounts.waitlisted > 0
                            ? t("admin.waiting", { count: event.visibleCounts.waitlisted })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : t("admin.noRsvp")}
                  </p>
                </div>
                <ChevronRightIcon
                  className="size-5 shrink-0 text-sm text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
