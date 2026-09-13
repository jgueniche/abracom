"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type ProfileState, updateMessagingDoor } from "@/server/actions/profile";

const initialState: ProfileState = { status: "idle" };

/**
 * The one lever a teacher, a secretary or the head holds over their own inbox.
 *
 * The tap of session 19 belongs to the direction and covers the whole school.
 * What was missing is smaller and personal: "je veux pouvoir interdire l'envoi
 * de message direct de parents, sans bloquer mes collègues." The sentence under
 * the switch says exactly that, because a switch that seems to cut you off from
 * the direction would never be used.
 */
export function MessagingDoorForm({ accepts }: { accepts: boolean }) {
  const t = useTranslations("messaging");
  const [state, action, isPending] = useActionState(updateMessagingDoor, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="acceptsParentDm">{t("doorOpen")}</Label>
        {/* the switch itself is 32 × 18 px: the padded label around it carries the target */}
        <label
          htmlFor="acceptsParentDm"
          className="flex min-h-11 min-w-11 items-center justify-end"
        >
          <Switch id="acceptsParentDm" name="acceptsParentDm" defaultChecked={accepts} />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{t("doorHint")}</p>
      {state.status !== "idle" && (
        <p
          role="status"
          className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}
        >
          {state.message}
        </p>
      )}
      <Button type="submit" variant="outline" className="min-h-11 self-start" disabled={isPending}>
        {t("doorSave")}
      </Button>
    </form>
  );
}
