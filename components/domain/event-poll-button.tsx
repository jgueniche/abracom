"use client";

import { BarChart3Icon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/server/actions/admin/_shared";
import { createThreadPoll } from "@/server/actions/messaging";

const initial: ActionState = { status: "idle" };

/**
 * "Who is coming?" asked in the conversation instead of the event page.
 *
 * An event's RSVP reaches whoever the event targets and waits for them to open
 * the agenda. A poll pushed into a class group asks the question where the
 * families already are, and links back to the event.
 */
export function EventPollButton({
  eventId,
  eventTitle,
  threads,
}: {
  eventId: string;
  eventTitle: string;
  threads: Array<{ id: string; label: string }>;
}) {
  const t = useTranslations("agenda.poll");
  const tPoll = useTranslations("messaging.poll");
  const [state, action] = useActionState(createThreadPoll, initial);
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState(threads[0]?.id ?? "");

  if (threads.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          <BarChart3Icon aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="options" value={tPoll("presetPresent")} />
          <input type="hidden" name="options" value={tPoll("presetAbsent")} />
          <input type="hidden" name="options" value={tPoll("presetMaybe")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="poll-thread">{t("thread")}</Label>
            <select
              id="poll-thread"
              name="threadId"
              value={threadId}
              onChange={(event) => setThreadId(event.target.value)}
              className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="poll-question">{tPoll("question")}</Label>
            <Input
              id="poll-question"
              name="question"
              required
              maxLength={300}
              defaultValue={t("question", { title: eventTitle })}
              className="min-h-11"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {t("answers", {
              answers: [tPoll("presetPresent"), tPoll("presetAbsent"), tPoll("presetMaybe")].join(
                " · ",
              ),
            })}
          </p>

          <ActionMessage status={state.status} message={state.message} />
          {state.status === "success" ? (
            <Button asChild className="self-start">
              <Link href={`/messages/${threadId}`}>
                <ExternalLinkIcon aria-hidden />
                {t("openThread")}
              </Link>
            </Button>
          ) : (
            <SubmitButton pendingLabel={tPoll("creating")} className="self-start">
              {t("send")}
            </SubmitButton>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
