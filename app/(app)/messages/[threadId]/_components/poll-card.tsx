"use client";

import { BarChart3Icon, CalendarDaysIcon, CheckIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { closePoll, voteInPoll } from "@/server/actions/messaging";

export type ThreadPollView = {
  id: string;
  messageId: string | null;
  question: string;
  options: string[];
  multiple: boolean;
  closesAt: string | null;
  closedAt: string | null;
  createdBy: string | null;
  event: { id: string; title: string; startsAt: string } | null;
  votes: Array<{ userId: string; optionIndex: number }>;
};

/**
 * A poll, read as a result and answered in place.
 *
 * Votes are attributed on purpose: asking a class group "who is coming?" is
 * only useful if the answer names people. Everyone who can read the thread sees
 * who answered what — the card says so rather than implying a secret ballot.
 */
export function PollCard({
  poll,
  threadId,
  meId,
  names,
  canClose,
}: {
  poll: ThreadPollView;
  threadId: string;
  meId: string;
  /** user id → display name, for the "who answered" line. */
  names: Map<string, string>;
  canClose: boolean;
}) {
  const t = useTranslations("messaging.poll");
  const format = useFormatter();
  const mine = poll.votes.filter((vote) => vote.userId === meId).map((vote) => vote.optionIndex);
  const [picked, setPicked] = useState<number[]>(mine);

  const expired = poll.closesAt !== null && new Date(poll.closesAt) <= new Date();
  const closed = poll.closedAt !== null || expired;
  const voters = new Set(poll.votes.map((vote) => vote.userId));
  const changed = picked.length !== mine.length || picked.some((choice) => !mine.includes(choice));

  const toggle = (index: number) => {
    if (closed) return;
    setPicked((current) =>
      poll.multiple
        ? current.includes(index)
          ? current.filter((item) => item !== index)
          : [...current, index]
        : [index],
    );
  };

  return (
    <div className="mt-2 max-w-lg rounded-xl border border-border bg-card p-3 shadow-soft">
      <p className="eyebrow mb-2 flex flex-wrap items-center gap-x-2">
        <BarChart3Icon className="size-3.5 text-primary" aria-hidden />
        {t("label")}
        {poll.multiple && <span>· {t("multiple")}</span>}
        {closed ? (
          <span className="flex items-center gap-1 text-brick">
            <LockIcon className="size-3" aria-hidden />
            {t("closed")}
          </span>
        ) : (
          poll.closesAt && (
            <span>
              ·{" "}
              {t("closesOn", {
                date: format.dateTime(new Date(poll.closesAt), { dateStyle: "medium" }),
              })}
            </span>
          )
        )}
      </p>

      <p className="mb-1 font-medium">{poll.question}</p>
      {poll.event && (
        <Link
          href={`/agenda/${poll.event.id}`}
          className="mb-2 flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-2 hover:underline"
        >
          <CalendarDaysIcon className="size-4" aria-hidden />
          {poll.event.title} ·{" "}
          {format.dateTime(new Date(poll.event.startsAt), { dateStyle: "medium" })}
        </Link>
      )}

      <form action={voteInPoll} className="flex flex-col gap-1.5">
        <input type="hidden" name="pollId" value={poll.id} />
        <input type="hidden" name="threadId" value={threadId} />
        {picked.map((choice) => (
          <input key={choice} type="hidden" name="choices" value={choice} />
        ))}

        <ul className="flex flex-col gap-1.5">
          {poll.options.map((option, index) => {
            const votes = poll.votes.filter((vote) => vote.optionIndex === index);
            const share = voters.size === 0 ? 0 : Math.round((votes.length / voters.size) * 100);
            const isPicked = picked.includes(index);
            const who = votes
              .map((vote) => names.get(vote.userId))
              .filter(Boolean)
              .join(", ");
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  disabled={closed}
                  aria-pressed={isPicked}
                  className={cn(
                    "relative flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-lg border px-3 text-left text-sm",
                    isPicked ? "border-primary" : "border-border",
                    closed ? "cursor-default" : "hover:bg-accent/50",
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/12"
                    style={{ width: `${share}%` }}
                  />
                  <CheckIcon
                    className={cn("relative size-4 shrink-0", !isPicked && "opacity-25")}
                    aria-hidden
                  />
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate">{option}</span>
                    {who && (
                      <span className="block truncate text-xs text-muted-foreground">{who}</span>
                    )}
                  </span>
                  <span className="relative shrink-0 text-xs text-muted-foreground tabular-nums">
                    {votes.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">{t("voters", { count: voters.size })}</p>
          {!closed && (
            <Button
              type="submit"
              size="sm"
              variant={changed ? "default" : "outline"}
              className="ml-auto min-h-11"
              disabled={picked.length === 0}
            >
              {mine.length > 0 ? t("changeVote") : t("vote")}
            </Button>
          )}
        </div>
      </form>

      {!closed && canClose && (
        <form action={closePoll} className="mt-1">
          <input type="hidden" name="pollId" value={poll.id} />
          <input type="hidden" name="threadId" value={threadId} />
          <Button type="submit" variant="ghost" size="sm" className="min-h-11 px-2">
            <LockIcon aria-hidden />
            {t("close")}
          </Button>
        </form>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{t("public")}</p>
    </div>
  );
}
