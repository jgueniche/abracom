"use client";

import { UsersRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createGroupThread } from "@/server/actions/messaging";
import type { ActionState } from "@/server/actions/admin/_shared";

type ClassRow = { id: string; name: string; level: string | null; guardians: number };

const initial: ActionState = { status: "idle" };

/**
 * Pick classes, not people.
 *
 * Ticking a class enrols every guardian of every pupil in it — both parents of
 * a family, a grandparent who holds an account, the second home — which is
 * exactly the list nobody can assemble by hand and the reason a trip or a
 * project ends up on a private messaging app instead.
 */
export function GroupForm({ classes }: { classes: ClassRow[] }) {
  const t = useTranslations("messaging.group");
  const [state, action] = useActionState(createGroupThread, initial);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  // Guardians are counted per class, and a family with two children in two of
  // them is one person: this is an upper bound, and it says so.
  const reach = classes
    .filter((cls) => selected.includes(cls.id))
    .reduce((total, cls) => total + cls.guardians, 0);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">{t("name")}</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={120}
          placeholder={t("namePlaceholder")}
          className="min-h-11"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("classes")}</legend>
        <p className="mb-2 text-sm text-muted-foreground">{t("classesHint")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {classes.map((cls) => {
            const active = selected.includes(cls.id);
            return (
              <li key={cls.id}>
                <label
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors",
                    active ? "border-primary bg-accent/60" : "border-border bg-card",
                  )}
                >
                  <input
                    type="checkbox"
                    name="classIds"
                    value={cls.id}
                    checked={active}
                    onChange={() => toggle(cls.id)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{cls.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("guardians", { count: cls.guardians })}
                    </span>
                  </span>
                  {cls.level && (
                    <Badge variant="secondary" className="ml-auto">
                      {cls.level}
                    </Badge>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="includeTeachers"
          defaultChecked
          className="size-5 shrink-0 accent-primary"
        />
        {t("includeTeachers")}
      </label>

      <p
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground"
      >
        <UsersRoundIcon className="size-4 shrink-0" aria-hidden />
        {selected.length === 0 ? t("reachEmpty") : t("reach", { count: reach })}
      </p>

      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton pendingLabel={t("creating")} className="self-start">
        {t("create")}
      </SubmitButton>
    </form>
  );
}
