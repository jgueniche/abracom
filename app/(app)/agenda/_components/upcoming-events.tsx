import { ChevronRightIcon } from "lucide-react";
import { SectionHeader } from "@/components/layouts/section-header";
import { Link } from "@/components/ui/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { type AgendaEvent, getUpcomingEvents } from "@/server/queries/agenda";

import { EventCard } from "./event-card";

/** The next three events, from now. */
export function upcomingEventsFor(userId: string) {
  return getUpcomingEvents(userId, new Date().toISOString(), 3);
}

/**
 * Home widget: the next three events for the signed-in user.
 *
 * The events are fetched by the screen that places the widget, together with
 * its own queries. Rendered as a rail element created *after* the screen had
 * awaited everything else, the widget used to start its query only once the
 * seven others had returned — on the hosted database that second wave was the
 * slowest query of the page (300 ms) and it ran alone, after the rest. The
 * home screen's database time was 620 ms in sequence for 300 ms of work in
 * parallel (ADR-0067).
 */
export async function UpcomingEvents({
  events: pending,
}: {
  events: AgendaEvent[] | Promise<AgendaEvent[]>;
}) {
  const [t, events] = await Promise.all([getTranslations("agenda.upcoming"), pending]);
  return (
    <section className="mt-2">
      <SectionHeader
        rule={false}
        label={t("title")}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/agenda">
              {t("seeAll")}
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        }
      />
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="border-t border-rule">
          {events.map((event) => (
            <li key={event.id} className="border-b border-rule">
              <EventCard event={event} showDate />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
