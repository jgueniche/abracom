"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { idle } from "@/server/actions/admin/_shared-client";
import { createClass, updateClass } from "@/server/actions/admin/classes";

export type LevelOption = { id: string; code: string; label: string };

export function ClassForm({
  levels,
  initial,
}: {
  levels: LevelOption[];
  initial?: {
    id: string;
    name: string;
    levelId: string;
    room: string | null;
    capacity: number | null;
    archived: boolean;
  };
}) {
  const t = useTranslations("admin.classes");
  const [state, action] = useActionState(initial ? updateClass : createClass, idle);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {initial && <input type="hidden" name="classId" value={initial.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initial?.name}
          required
          maxLength={80}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="levelId">{t("level")}</Label>
        <Select name="levelId" defaultValue={initial?.levelId ?? levels[0]?.id}>
          <SelectTrigger id="levelId" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((level) => (
              <SelectItem key={level.id} value={level.id}>
                {level.code} · {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="room">{t("room")}</Label>
        <Input
          id="room"
          name="room"
          defaultValue={initial?.room ?? ""}
          maxLength={40}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="capacity">{t("capacity")}</Label>
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          max={60}
          defaultValue={initial?.capacity ?? ""}
          className="min-h-11"
        />
      </div>
      {initial && (
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="archived"
            defaultChecked={initial.archived}
            className="size-5 accent-primary"
          />
          {t("archived")}
        </label>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{initial ? t("save") : t("create")}</SubmitButton>
      </div>
    </form>
  );
}
