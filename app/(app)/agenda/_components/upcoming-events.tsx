import { ChevronRightIcon } from "lucide-react";
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
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/agenda">
            {t("seeAll")}
            <ChevronRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} showDate />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
