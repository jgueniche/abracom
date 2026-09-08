import { ClockIcon, MapPinIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import type { AgendaEvent } from "@/server/queries/agenda";

import { RsvpBadge } from "./rsvp-badge";

/** One event row of the agenda / upcoming lists (server component). */
export async function EventCard({
  event,
  continued = false,
  showDate = false,
}: {
  event: AgendaEvent;
  continued?: boolean;
  showDate?: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations("agenda"), getFormatter()]);
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const time = event.all_day
    ? t("allDay")
    : end
      ? `${format.dateTime(start, { timeStyle: "short" })} – ${format.dateTime(end, { timeStyle: "short" })}`
      : format.dateTime(start, { timeStyle: "short" });
  const volunteersOpen = event.slots.reduce(
    (sum, s) => sum + Math.max(0, s.needed - s.signups.length),
    0,
  );

  return (
    <Link
      href={`/agenda/${event.id}`}
      className="flex min-h-11 flex-col gap-1 rounded-2xl border p-3 hover:bg-accent/60"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={event.kind === "holiday" ? "outline" : "secondary"}>
          {t(`kinds.${event.kind}`)}
        </Badge>
        {event.requires_rsvp && <RsvpBadge rsvp={event.myRsvp} />}
        {volunteersOpen > 0 && (
          <Badge variant="outline">
            <UsersIcon aria-hidden />
            {t("slots.title")} · {volunteersOpen}
          </Badge>
        )}
      </div>
      <p className="font-heading font-semibold">
        {event.title} {continued && <span className="text-muted-foreground">{t("continued")}</span>}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="size-3.5" aria-hidden />
          {showDate ? `${format.dateTime(start, { dateStyle: "medium" })} · ${time}` : time}
        </span>
        {event.location && (
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-3.5" aria-hidden />
            {event.location}
          </span>
        )}
      </p>
    </Link>
  );
}
