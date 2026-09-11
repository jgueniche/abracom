import { ChevronRightIcon } from "lucide-react";
import { SectionHeader } from "@/components/layouts/section-header";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { getUpcomingEvents } from "@/server/queries/agenda";

import { EventCard } from "./event-card";

/** Home widget: the next three events for the signed-in user. */
export async function UpcomingEvents({ userId }: { userId: string }) {
  const [t, events] = await Promise.all([
    getTranslations("agenda.upcoming"),
    getUpcomingEvents(userId, new Date().toISOString(), 3),
  ]);
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
