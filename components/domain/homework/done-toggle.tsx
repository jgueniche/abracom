"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { doneKey, type SubjectTone } from "@/lib/homework";
import { cn } from "@/lib/utils";

import { useHomeworkProgress } from "./progress";
import { TONE_CLASSES } from "./tones";

/**
 * « Fait » — the ring a child taps when the homework is done.
 *
 * It was a button reading « Vu », which a parent pressed to tell the teacher the information had
 * arrived. What a family does with homework in the evening is a list: the ring is drawn in the
 * colour of the subject, fills when tapped, and celebrates for half a second. With one child the
 * ring stands alone beside the title; with two in the same class, each carries its first name.
 */
export function DoneToggle({
  postId,
  studentId,
  title,
  tone,
  childName,
  showName = false,
  readOnly = false,
  size = "lg",
  withText = false,
}: {
  postId: string;
  studentId: string;
  /** The homework's title, for the accessible name. */
  title: string;
  tone: SubjectTone;
  childName: string;
  showName?: boolean;
  /** A read-only guardian sees what the parents ticked, and cannot tick. */
  readOnly?: boolean;
  size?: "lg" | "sm";
  /** Spell the state beside the ring — « Marquer comme fait » / « Fait » — where there is room. */
  withText?: boolean;
}) {
  const t = useTranslations("diary");
  const { done: ticks, toggle } = useHomeworkProgress();
  const done = ticks.has(doneKey(postId, studentId));
  // Each new tick replays the celebration; unticking plays nothing.
  const [celebrations, setCelebrations] = useState(0);
  const classes = TONE_CLASSES[tone];
  const label = showName ? t("doneFor", { title, name: childName }) : t("doneLabel", { title });

  const ring = (
    <span
      key={done ? `done-${celebrations}` : "todo"}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        size === "lg" ? "size-7" : "size-6",
        done ? cn(classes.fill, celebrations > 0 && "tick-pop") : cn(classes.ring, "bg-card"),
        // a state to read, not a control: the read-only ring is dashed, so it does not ask a tap
        !done && readOnly && "border-dashed",
      )}
    >
      {done && (
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className={cn("size-4 text-background", celebrations > 0 && "tick-draw")}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {done && celebrations > 0 && <span aria-hidden className={cn("tick-burst", classes.text)} />}
    </span>
  );

  if (readOnly)
    return (
      <span className="flex min-h-11 items-center gap-2">
        {ring}
        <span className={cn("text-sm", showName ? "font-medium" : "sr-only")}>
          {showName ? childName : null}
        </span>
        <span className="sr-only">{done ? t("doneState") : t("todoState")}</span>
      </span>
    );

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={() => {
        if (!done) setCelebrations((count) => count + 1);
        toggle(postId, studentId);
      }}
      className={cn(
        "group/tick -m-2 flex min-h-11 min-w-11 items-center gap-2 rounded-full p-2 transition-colors",
        "hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-0",
      )}
    >
      {ring}
      {(showName || withText) && (
        <span
          className={cn(
            "text-sm font-medium",
            done ? "text-foreground" : "text-foreground/80 group-hover/tick:text-foreground",
          )}
        >
          {withText
            ? `${done ? t("doneState") : t("markDone")}${showName ? ` · ${childName}` : ""}`
            : childName}
        </span>
      )}
    </button>
  );
}
