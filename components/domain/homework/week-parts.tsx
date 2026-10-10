"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useProgressOf } from "./progress";

export type StripDay = {
  day: string;
  /** "lun." */
  weekday: string;
  /** "6" */
  date: string;
  /** Spoken name: "mardi 6 octobre". */
  label: string;
  count: number;
  /** The ticks of this day, for a reader who ticks. */
  keys: string[];
  pivot: boolean;
  today: boolean;
  past: boolean;
};

/**
 * The week at a glance, as a calendar strip: five days, each with what it holds.
 *
 * The list used to give every day its own line, so a week with two homework spent the whole
 * first screen of a phone saying « Rien à préparer » five times. The strip says it in one row —
 * a day with nothing is simply a day with nothing under it — and the list below only holds days
 * that hold something. For a family, each day's mark fills as its homework is ticked.
 */
export function WeekStrip({ days, ticks }: { days: StripDay[]; ticks: boolean }) {
  const t = useTranslations("diary");
  return (
    <nav aria-label={t("weekDays")}>
      <ol
        className="grid border-b border-rule"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => (
          <li key={day.day} className="relative">
            <StripCell day={day} ticks={ticks} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StripCell({ day, ticks }: { day: StripDay; ticks: boolean }) {
  const t = useTranslations("diary");
  const progress = useProgressOf(day.keys);
  const inner = (
    <>
      <span
        className={cn(
          "text-[0.6875rem] font-semibold tracking-[0.06em] uppercase",
          day.pivot ? "text-primary" : day.past ? "text-muted-foreground" : "text-foreground/70",
        )}
      >
        {day.weekday}
      </span>
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-base tabular-nums",
          day.today && "bg-primary font-semibold text-primary-foreground",
          !day.today && day.pivot && "font-semibold text-primary",
          !day.today && !day.pivot && day.past && "text-muted-foreground",
        )}
      >
        {day.date}
      </span>
      <span className="flex h-5 items-center" aria-hidden>
        {day.count === 0 ? null : ticks && progress.total > 0 ? (
          <ProgressRing done={progress.done} total={progress.total} />
        ) : (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[0.625rem] font-semibold text-secondary-foreground tabular-nums">
            {day.count}
          </span>
        )}
      </span>
      {day.pivot && (
        <span
          aria-hidden
          className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-primary"
        />
      )}
    </>
  );
  const spoken = `${day.label} — ${
    day.count === 0
      ? t("stripNothing")
      : ticks && progress.total > 0
        ? t("stripProgress", { done: progress.done, total: progress.total })
        : t("stripCount", { count: day.count })
  }`;
  const classes = "flex min-h-11 flex-col items-center gap-0.5 pt-2 pb-2.5";
  if (day.count === 0)
    return (
      <span className={classes}>
        {inner}
        <span className="sr-only">{spoken}</span>
      </span>
    );
  return (
    <a
      href={`#jour-${day.day}`}
      aria-current={day.pivot ? "date" : undefined}
      className={cn(classes, "rounded-md transition-colors hover:bg-muted/70")}
    >
      {inner}
      <span className="sr-only">{spoken}</span>
    </a>
  );
}

/** A ring that fills as the day's homework is ticked, and turns into a tick when it is full. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const complete = total > 0 && done >= total;
  if (complete)
    return (
      <span className="tick-pop flex size-4 items-center justify-center rounded-full bg-success text-success-foreground">
        <CheckIcon className="size-3" strokeWidth={3.5} />
      </span>
    );
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 16 16" className="size-4 -rotate-90">
      <circle cx="8" cy="8" r={radius} fill="none" stroke="var(--border)" strokeWidth="2.5" />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke="var(--success)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - (total ? done / total : 0))}
        className="transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  );
}

/** "3 sur 5 faits" and a rule that fills — and, once it is full, the one sentence of praise. */
export function WeekProgress({ keys }: { keys: string[] }) {
  const t = useTranslations("diary");
  const progress = useProgressOf(keys);
  if (progress.total === 0) return null;
  const percent = Math.round((progress.done / progress.total) * 100);
  return (
    <div className="flex items-center gap-3 pt-3" role="status">
      <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-success transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          progress.complete ? "font-semibold text-success" : "text-muted-foreground",
        )}
      >
        {progress.complete
          ? t("weekComplete")
          : t("weekProgress", { done: progress.done, total: progress.total })}
      </span>
    </div>
  );
}

/** Beside a day's label: "1 / 3", then "Tout est fait" once the last one is ticked. */
export function DayProgress({ keys }: { keys: string[] }) {
  const t = useTranslations("diary");
  const progress = useProgressOf(keys);
  if (progress.total === 0) return null;
  if (progress.complete)
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-success">
        <CheckIcon className="size-3.5" aria-hidden strokeWidth={3} />
        {t("dayComplete")}
      </span>
    );
  return <span>{t("dayProgress", { done: progress.done, total: progress.total })}</span>;
}

/** Under the day being prepared, once it is all done. */
export function DayCelebration({ keys, message }: { keys: string[]; message: string }) {
  const progress = useProgressOf(keys);
  if (!progress.complete) return null;
  return (
    <p
      role="status"
      className="mb-2 animate-in rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success duration-300 fade-in-0 slide-in-from-top-1"
    >
      {message}
    </p>
  );
}

/** A homework whose every tick is done steps back: the title quiets, the ring says why. */
export function EntryFrame({
  keys,
  children,
  id,
  className,
}: {
  keys: string[];
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const progress = useProgressOf(keys);
  return (
    <article
      id={id}
      data-done={progress.complete || undefined}
      className={cn("group/entry", className)}
    >
      {children}
    </article>
  );
}
