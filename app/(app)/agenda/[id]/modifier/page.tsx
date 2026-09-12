import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireSchoolRole } from "@/lib/auth/guards";
import { utcToZonedNaive } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { isSchoolStaff } from "@/lib/permissions";
import { getEvent, getEventAudienceOptions } from "@/server/queries/agenda";

import { DeleteEventButton } from "../../_components/delete-event-button";
import { EventForm, type EventInitial } from "../../_components/event-form";
import { SlotEditor } from "../../_components/slot-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agenda.form");
  return { title: t("editTitle") };
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, schoolId } = await requireSchoolRole(["school_admin", "staff", "teacher"]);
  const [t, ta, locale, event, options] = await Promise.all([
    getTranslations("agenda.form"),
    getTranslations("agenda"),
    getLocale(),
    getEvent(user.id, id),
    getEventAudienceOptions(user, schoolId),
  ]);
  if (!event) notFound();
  if (!(isSchoolStaff(user.roles, schoolId) || event.created_by === user.id)) {
    redirect(`/agenda/${id}`);
  }

  const timezone = user.school?.timezone ?? TIME_ZONE;
  const initial: EventInitial = {
    id: event.id,
    title: event.title,
    descriptionMd: event.description_md,
    kind: event.kind,
    scope: event.scope,
    targetIds: event.target_ids,
    allDay: event.all_day,
    startsAt: utcToZonedNaive(event.starts_at, timezone),
    endsAt: event.ends_at ? utcToZonedNaive(event.ends_at, timezone) : "",
    location: event.location,
    requiresRsvp: event.requires_rsvp,
    capacity: event.capacity,
    rsvpDeadline: event.rsvp_deadline ? utcToZonedNaive(event.rsvp_deadline, timezone) : "",
    costNote: event.cost_note,
  };

  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={`/agenda/${event.id}`}>
          <ArrowLeftIcon aria-hidden />
          {ta("back")}
        </Link>
      </Button>
      <PageHeader title={t("editTitle")} description={event.title} />
      <div className="flex flex-col gap-8">
        <EventForm options={options} locale={locale} initial={initial} />
        <SlotEditor
          eventId={event.id}
          slots={event.slots.map((s) => ({
            id: s.id,
            label: s.label,
            needed: s.needed,
            taken: s.signups.length,
          }))}
        />
        <div className="border-t pt-6">
          <DeleteEventButton id={event.id} />
        </div>
      </div>
    </Column>
  );
}
