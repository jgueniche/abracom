"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * The reader's own answer to an invitation.
 *
 * A marker, not a badge: it lives inside a dateline already set in small caps,
 * next to the kind of the event, and a filled capsule with a glyph in it there
 * weighed more than the title underneath. Colour carries the four states —
 * accepted, waitlisted, undecided, declined — and the word carries the meaning.
 */
export function RsvpBadge({
  rsvp,
}: {
  rsvp: { status: "yes" | "no" | "maybe"; waitlisted: boolean } | null;
}) {
  const t = useTranslations("agenda.rsvp");
  if (!rsvp) return null;

  const [label, tone] =
    rsvp.status === "yes" && rsvp.waitlisted
      ? [t("waitlistedBadge"), "text-warning"]
      : rsvp.status === "yes"
        ? [t("confirmedBadge"), "text-success"]
        : rsvp.status === "maybe"
          ? [t("maybeBadge"), "text-muted-foreground"]
          : [t("noBadge"), "text-muted-foreground"];

  return (
    <span className={cn("text-[0.6875rem] font-semibold tracking-[0.085em] uppercase", tone)}>
      {label}
    </span>
  );
}
