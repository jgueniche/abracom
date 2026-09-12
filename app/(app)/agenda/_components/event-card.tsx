import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import type { AgendaEvent } from "@/server/queries/agenda";

import { RsvpBadge } from "./rsvp-badge";

/**
 * One event of the agenda, set as an entry rather than as a card.
 *
 * It used to carry two badges, a clock glyph and a pin glyph for four facts —
 * kind, answer, time, place — which in an 18 rem rail left the title fighting
 * its own furniture for room. The kind and the moment now share the dateline,
 * the place follows the title as plain text, and the only thing that keeps a
 * coloured mark is the one fact that concerns the reader personally: whether
 * they have answered.
 */
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
      className="-mx-2 block rounded-md px-2 py-3 transition-colors hover:bg-muted/50"
    >
      <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{t(`kinds.${event.kind}`)}</span>
        <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground/45" />
        <span>
          {showDate ? `${format.dateTime(start, { dateStyle: "medium" })} · ${time}` : time}
        </span>
        {event.requires_rsvp && (
          <span className="ml-auto shrink-0">
            <RsvpBadge rsvp={event.myRsvp} />
          </span>
        )}
      </p>
      <p className="mt-1 font-heading text-base leading-snug font-normal text-pretty">
        {event.title} {continued && <span className="text-muted-foreground">{t("continued")}</span>}
      </p>
      {(event.location || volunteersOpen > 0) && (
        <p className="meta mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {event.location}
          {event.location && volunteersOpen > 0 && (
            <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground/45" />
          )}
          {volunteersOpen > 0 && (
            <span className="text-warning">
              {t("slots.title")} · {volunteersOpen}
            </span>
          )}
        </p>
      )}
    </Link>
  );
}
