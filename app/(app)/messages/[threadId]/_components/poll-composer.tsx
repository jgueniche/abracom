"use client";

import { BarChart3Icon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";

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
const MAX_OPTIONS = 10;

/**
 * Asking the question is the hard part, so the two the school always asks —
 * a yes/no and a presence check — are one tap, and the rest is free text.
 */
export function PollComposer({ threadId }: { threadId: string }) {
  const t = useTranslations("messaging.poll");
  const [state, action] = useActionState(createThreadPoll, initial);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      setOptions(["", ""]);
    }
  }, [state.status]);

  const preset = (values: string[]) => setOptions(values);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="size-11" title={t("new")}>
          <BarChart3Icon aria-hidden />
          <span className="sr-only">{t("new")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
          <DialogDescription>{t("newHint")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="threadId" value={threadId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="poll-question">{t("question")}</Label>
            <Input
              id="poll-question"
              name="question"
              required
              minLength={3}
              maxLength={300}
              placeholder={t("questionPlaceholder")}
              className="min-h-11"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={() => preset([t("presetYes"), t("presetNo")])}
            >
              {t("presetYesNo")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={() => preset([t("presetPresent"), t("presetAbsent"), t("presetMaybe")])}
            >
              {t("presetAttendance")}
            </Button>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("options")}</legend>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  name="options"
                  value={option}
                  required={index < 2}
                  maxLength={120}
                  aria-label={t("option", { number: index + 1 })}
                  placeholder={t("option", { number: index + 1 })}
                  className="min-h-11"
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((item, position) =>
                        position === index ? event.target.value : item,
                      ),
                    )
                  }
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-label={t("removeOption", { number: index + 1 })}
                    onClick={() =>
                      setOptions((current) => current.filter((_, position) => position !== index))
                    }
                  >
                    <XIcon aria-hidden />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 self-start px-2"
                onClick={() => setOptions((current) => [...current, ""])}
              >
                <PlusIcon aria-hidden />
                {t("addOption")}
              </Button>
            )}
          </fieldset>

          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="multiple" className="size-5 shrink-0 accent-primary" />
            {t("allowMultiple")}
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="poll-closes">{t("closesAt")}</Label>
            <Input id="poll-closes" name="closesAt" type="date" className="min-h-11" />
          </div>

          <ActionMessage status={state.status} message={state.message} />
          <SubmitButton pendingLabel={t("creating")} className="self-start">
            {t("create")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
