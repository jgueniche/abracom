import { ArrowLeftIcon, CoinsIcon, MapPinIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/domain/markdown";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { localDateKey } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { canWriteInSchool, isSchoolStaff } from "@/lib/permissions";
import { cancelSlotSignup } from "@/server/actions/agenda";
import { cache } from "react";

import { getEvent, getEventRecipients } from "@/server/queries/agenda";

const loadEvent = cache((userId: string, id: string) => getEvent(userId, id));

import { RsvpBadge } from "../_components/rsvp-badge";
import { RsvpForm } from "../_components/rsvp-form";
import { SlotJoinForm } from "../_components/slot-join-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requireCurrentUser();
  const event = await loadEvent(user.id, id);
  return { title: event?.title ?? "" };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [t, format, event] = await Promise.all([
    getTranslations("agenda"),
    getFormatter(),
    loadEvent(user.id, id),
  ]);
  if (!event) notFound();

  const timezone = user.school?.timezone ?? TIME_ZONE;
  const staff = isSchoolStaff(user.roles, event.school_id);
  const canEdit = staff || event.created_by === user.id;
  const canRespond = canWriteInSchool(user.roles, event.school_id);
  const recipients = canEdit ? await getEventRecipients(event.id) : [];
  const answered = recipients.filter((r) => r.status !== null);
  const pending = recipients.filter((r) => r.status === null);

  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const multiDay = end !== null && localDateKey(end, timezone) !== localDateKey(start, timezone);
  const when = event.all_day
    ? multiDay
      ? `${format.dateTime(start, { dateStyle: "full" })} → ${format.dateTime(end!, { dateStyle: "full" })}`
      : format.dateTime(start, { dateStyle: "full" })
    : `${format.dateTime(start, { dateStyle: "full", timeStyle: "short" })}${
        end
          ? ` – ${format.dateTime(end, multiDay ? { dateStyle: "medium", timeStyle: "short" } : { timeStyle: "short" })}`
          : ""
      }`;
  const deadline = event.rsvp_deadline ? new Date(event.rsvp_deadline) : null;
  const closed = deadline !== null && deadline.getTime() < Date.now();
  const counts = event.counts;
  const fill = event.capacity
    ? Math.min(100, Math.round((counts.yes_seats / event.capacity) * 100))
    : null;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/agenda">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={event.title}
        description={when}
        actions={
          canEdit ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/agenda/${event.id}/modifier`}>
                <PencilIcon aria-hidden />
                {t("edit")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{t(`kinds.${event.kind}`)}</Badge>
        <Badge variant="outline">{t(`scope.${event.scope}`)}</Badge>
        {event.requires_rsvp && <RsvpBadge rsvp={event.myRsvp} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3">
              {event.location && (
                <p className="flex items-center gap-2 text-sm">
                  <MapPinIcon className="size-4 shrink-0" aria-hidden />
                  {event.location}
                </p>
              )}
              {event.cost_note && (
                <p className="flex items-center gap-2 text-sm">
                  <CoinsIcon className="size-4 shrink-0" aria-hidden />
                  {t("cost")} : {event.cost_note}
                </p>
              )}
              {event.creator && (
                <p className="text-sm text-muted-foreground">
                  {t("by", { name: `${event.creator.first_name} ${event.creator.last_name}` })}
                </p>
              )}
              {event.description_md && <Markdown>{event.description_md}</Markdown>}
            </CardContent>
          </Card>

          {event.slots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("slots.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-4">
                  {event.slots.map((slot) => {
                    const mine = slot.signups.some((s) => s.user_id === user.id);
                    const full = slot.signups.length >= slot.needed;
                    return (
                      <li key={slot.id} className="flex flex-col gap-2 rounded-xl border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{slot.label}</p>
                          <Badge variant={full ? "outline" : "secondary"}>
                            {t("slots.needed", { taken: slot.signups.length, needed: slot.needed })}
                            {full ? ` · ${t("slots.full")}` : ""}
                          </Badge>
                        </div>
                        {slot.signups.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {t("slots.volunteers")} :{" "}
                            {slot.signups
                              .map((s) =>
                                s.profile ? `${s.profile.first_name} ${s.profile.last_name}` : "—",
                              )
                              .join(", ")}
                          </p>
                        )}
                        {mine ? (
                          <form action={cancelSlotSignup}>
                            <input type="hidden" name="slotId" value={slot.id} />
                            <input type="hidden" name="eventId" value={event.id} />
                            <Button type="submit" variant="outline" size="sm" className="min-h-11">
                              {t("slots.leave")}
                            </Button>
                          </form>
                        ) : (
                          !full &&
                          canRespond && <SlotJoinForm slotId={slot.id} eventId={event.id} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {canEdit && event.requires_rsvp && (
            <Card>
              <CardHeader>
                <CardTitle>{t("attendees.title")}</CardTitle>
                <CardDescription>
                  {t("attendees.summary", {
                    yes: counts.yes_count,
                    maybe: counts.maybe_count,
                    no: counts.no_count,
                    pending: pending.length,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {answered.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-2 font-medium">{t("attendees.name")}</th>
                          <th className="py-1 pr-2 font-medium">{t("attendees.answer")}</th>
                          <th className="py-1 pr-2 font-medium">{t("attendees.guests")}</th>
                          <th className="py-1 font-medium">{t("attendees.note")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {answered.map((r) => (
                          <tr key={r.user_id} className="border-t">
                            <td className="py-1 pr-2">
                              {r.first_name} {r.last_name}
                            </td>
                            <td className="py-1 pr-2">
                              <RsvpBadge
                                rsvp={{ status: r.status!, waitlisted: r.waitlisted ?? false }}
                              />
                            </td>
                            <td className="py-1 pr-2">{r.guests_count ?? 0}</td>
                            <td className="py-1 text-muted-foreground">{r.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {pending.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer">
                      {t("attendees.showPending", { count: pending.length })}
                    </summary>
                    <p className="mt-2 text-muted-foreground">
                      {pending.map((r) => `${r.first_name} ${r.last_name}`).join(", ")}
                    </p>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {event.requires_rsvp && (
            <Card className={closed ? "bg-muted/40" : "border-primary"}>
              <CardHeader>
                <CardTitle>{t("rsvp.title")}</CardTitle>
                <CardDescription>
                  {[
                    event.capacity
                      ? t("rsvp.capacity", { seats: counts.yes_seats, capacity: event.capacity })
                      : t("rsvp.seats", { count: counts.yes_seats }),
                    counts.waitlisted_count > 0
                      ? t("rsvp.waiting", { count: counts.waitlisted_count })
                      : null,
                    deadline
                      ? t("rsvp.deadline", {
                          date: format.dateTime(deadline, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }),
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {fill !== null && (
                  <div className="h-2 rounded-full bg-muted" aria-hidden>
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${fill}%` }} />
                  </div>
                )}
                {closed ? (
                  <p className="text-sm text-muted-foreground">{t("rsvp.closed")}</p>
                ) : !canRespond ? (
                  <p className="text-sm text-muted-foreground">{t("rsvp.readOnly")}</p>
                ) : (
                  <RsvpForm
                    eventId={event.id}
                    initial={
                      event.myRsvp
                        ? {
                            status: event.myRsvp.status,
                            guests_count: event.myRsvp.guests_count,
                            note: event.myRsvp.note,
                          }
                        : null
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
