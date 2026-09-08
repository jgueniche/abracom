"use client";

import { CheckIcon, HelpCircleIcon, HourglassIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

export function RsvpBadge({
  rsvp,
}: {
  rsvp: { status: "yes" | "no" | "maybe"; waitlisted: boolean } | null;
}) {
  const t = useTranslations("agenda.rsvp");
  if (!rsvp) return null;
  if (rsvp.status === "yes" && rsvp.waitlisted) {
    return (
      <Badge variant="outline">
        <HourglassIcon aria-hidden />
        {t("waitlistedBadge")}
      </Badge>
    );
  }
  if (rsvp.status === "yes") {
    return (
      <Badge>
        <CheckIcon aria-hidden />
        {t("confirmedBadge")}
      </Badge>
    );
  }
  if (rsvp.status === "maybe") {
    return (
      <Badge variant="secondary">
        <HelpCircleIcon aria-hidden />
        {t("maybeBadge")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <XIcon aria-hidden />
      {t("noBadge")}
    </Badge>
  );
}
