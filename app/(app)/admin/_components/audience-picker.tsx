"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Label } from "@/components/ui/label";

export type AudienceOptions = {
  levels: Array<{ id: string; code: string; label_fr: string; label_en: string }>;
  classes: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; role: string }>;
};

export type Audience = "school" | "level" | "class" | "custom";

export function AudiencePicker({
  options,
  initialAudience = "school",
  initialTargets = [],
  locale,
  allowCustom = true,
  allowed,
}: {
  options: AudienceOptions;
  initialAudience?: Audience;
  initialTargets?: string[];
  locale: string;
  allowCustom?: boolean;
  /** Restricts the selectable audiences (e.g. teachers may only target their classes). */
  allowed?: Audience[];
}) {
  const t = useTranslations("adminAnnouncements.fields");
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const kinds: Audience[] =
    allowed ??
    (allowCustom ? ["school", "level", "class", "custom"] : ["school", "level", "class"]);
  const labels: Record<Audience, string> = {
    school: t("audienceSchool"),
    level: t("audienceLevel"),
    class: t("audienceClass"),
    custom: t("audienceCustom"),
  };

  const checkbox = (id: string, label: string) => (
    <label key={id} className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        name="targetIds"
        value={id}
        defaultChecked={initialTargets.includes(id)}
        className="size-5 accent-primary"
      />
      {label}
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">{t("audience")}</legend>
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <label
            key={kind}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${audience === kind ? "border-primary bg-primary text-primary-foreground" : ""}`}
          >
            <input
              type="radio"
              name="audience"
              value={kind}
              checked={audience === kind}
              onChange={() => setAudience(kind)}
              className="sr-only"
            />
            {labels[kind]}
          </label>
        ))}
      </div>
      {audience === "level" && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {options.levels.map((l) =>
            checkbox(l.id, `${l.code} · ${locale === "en" ? l.label_en : l.label_fr}`),
          )}
        </div>
      )}
      {audience === "class" && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {options.classes.map((c) => checkbox(c.id, c.name))}
        </div>
      )}
      {audience === "custom" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetIds">{t("targets")}</Label>
          <select
            id="targetIds"
            name="targetIds"
            multiple
            size={8}
            defaultValue={initialTargets}
            className="rounded-lg border border-input bg-background p-2 text-sm"
          >
            {options.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}
