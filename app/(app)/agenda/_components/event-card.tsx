import { Link } from "@/components/ui/link";
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
  const multiDay = event.all_day && end !== null && end.toDateString() !== start.toDateString();
  const time = event.all_day
    ? multiDay
      ? t("allDayRange", {
          from: format.dateTime(start, { day: "numeric", month: "short" }),
          to: format.dateTime(end!, { day: "numeric", month: "short" }),
        })
      : t("allDay")
    : end
      ? `${format.dateTime(start, { timeStyle: "short" })} – ${format.dateTime(end, { timeStyle: "short" })}`
      : format.dateTime(start, { timeStyle: "short" });
  const volunteersOpen = event.slots.reduce(
    (sum, s) => sum + Math.max(0, s.needed - s.signups.length),
    0,
  );

  const details = (
    <>
      <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{t(`kinds.${event.kind}`)}</span>
        <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground/45" />
        <span>{time}</span>
        {event.requires_rsvp && (
          <span className="ml-auto shrink-0">
            <RsvpBadge rsvp={event.myRsvp} />
          </span>
        )}
      </p>
      <p className="mt-0.5 font-heading text-base leading-snug font-normal text-pretty">
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
    </>
  );

  return (
    <Link
      href={`/agenda/${event.id}`}
      prefetch={false}
      className="-mx-3 flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted"
    >
      {/* Out of a day's list, the date is the left edge of the entry — what the avatar is to a
          conversation in Messages (ADR-0078) — rather than a clause of the dateline. */}
      {showDate && (
        <span className="flex w-9 shrink-0 flex-col items-center pt-0.5 leading-none">
          <span className="font-heading text-xl leading-none tabular-nums">
            {format.dateTime(start, { day: "numeric" })}
          </span>
          <span className="eyebrow mt-1 leading-none">
            {format.dateTime(start, { month: "short" }).replace(".", "")}
          </span>
        </span>
      )}
      <div className="min-w-0 flex-1">{details}</div>
    </Link>
  );
}
