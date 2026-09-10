"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ChannelPreference,
  NOTIFICATION_GROUPS,
  type NotificationGroup,
  type QuietHours,
} from "@/lib/notifications/kinds";
import { saveNotificationPreferences } from "@/server/actions/notifications";
import { idle } from "@/server/actions/admin/_shared-client";

export type PreferencesInitial = {
  channels: Record<NotificationGroup, ChannelPreference>;
  quietHours: QuietHours | null;
  shabbatMode: boolean;
};

const CHANNELS = ["push", "email", "digest"] as const;

export function PreferencesForm({ initial }: { initial: PreferencesInitial }) {
  const t = useTranslations("notificationPrefs");
  const [state, action] = useActionState(saveNotificationPreferences, idle);
  const [quietEnabled, setQuietEnabled] = useState(initial.quietHours !== null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="overflow-x-auto" tabIndex={0} role="group" aria-label={t("group")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 pr-2 font-medium">{t("group")}</th>
              {CHANNELS.map((channel) => (
                <th key={channel} className="py-2 pr-2 text-center font-medium">
                  {t(`channels.${channel}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_GROUPS.map((group) => (
              <tr key={group} className="border-t">
                <td className="py-2 pr-2">
                  <p className="font-medium">{t(`groups.${group}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`groups.${group}.hint`)}</p>
                </td>
                {CHANNELS.map((channel) => {
                  const disabled = group === "message" && channel === "email";
                  return (
                    <td key={channel} className="p-0 text-center">
                      {/* 24 boxes of 20 px on the one screen a parent opens to
                          stop the app notifying them, on a phone, at night */}
                      <label className="mx-auto flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-2">
                        <input
                          type="checkbox"
                          name={`${group}.${channel}`}
                          defaultChecked={!disabled && initial.channels[group][channel]}
                          disabled={disabled}
                          aria-label={`${t(`groups.${group}.label`)} · ${t(`channels.${channel}`)}`}
                          className="size-5 accent-primary disabled:opacity-40"
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
        <legend className="px-1 text-sm font-medium">{t("quiet.title")}</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="quietEnabled"
            checked={quietEnabled}
            onChange={(e) => setQuietEnabled(e.target.checked)}
            className="size-5 accent-primary"
          />
          {t("quiet.enabled")}
        </label>
        {quietEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quietStart">{t("quiet.start")}</Label>
              <Input
                id="quietStart"
                name="quietStart"
                type="time"
                defaultValue={initial.quietHours?.start ?? "21:00"}
                className="min-h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quietEnd">{t("quiet.end")}</Label>
              <Input
                id="quietEnd"
                name="quietEnd"
                type="time"
                defaultValue={initial.quietHours?.end ?? "07:00"}
                className="min-h-11"
              />
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("quiet.hint")}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-xl border p-3">
        <legend className="px-1 text-sm font-medium">{t("shabbat.title")}</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="shabbatMode"
            defaultChecked={initial.shabbatMode}
            className="size-5 accent-primary"
          />
          {t("shabbat.enabled")}
        </label>
        <p className="text-xs text-muted-foreground">{t("shabbat.hint")}</p>
      </fieldset>

      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 sm:self-start">{t("save")}</SubmitButton>
    </form>
  );
}
