"use client";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { type PromotionState, promoteSchoolYear } from "@/server/actions/admin/promotion";

const initialState: PromotionState = { status: "idle" };

export type PromotionRow = {
  classId: string;
  name: string;
  levelCode: string;
  students: number;
  proposedLevelId: string | null;
  proposedName: string;
};

export function PromotionForm({
  currentYearId,
  nextYearId,
  rows,
  levels,
  locale,
}: {
  currentYearId: string;
  nextYearId: string;
  rows: PromotionRow[];
  levels: Array<{ id: string; code: string; label_fr: string; label_en: string }>;
  locale: string;
}) {
  const t = useTranslations("admin.promotion");
  const [state, action] = useActionState(promoteSchoolYear, initialState);
  if (state.status === "success") {
    return <ActionMessage status="success" message={state.message} />;
  }
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="currentYear" value={currentYearId} />
      <input type="hidden" name="nextYear" value={nextYearId} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{t("currentClass")}</th>
              <th className="py-2 pr-3 font-medium">{t("students")}</th>
              <th className="py-2 pr-3 font-medium">{t("targetLevel")}</th>
              <th className="py-2 font-medium">{t("newName")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.classId} className="border-t align-middle">
                <td className="py-2 pr-3 font-medium whitespace-nowrap">
                  {row.name}{" "}
                  <span className="text-xs text-muted-foreground">({row.levelCode})</span>
                </td>
                <td className="py-2 pr-3">{row.students}</td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
                    <select
                      name={`target:${row.classId}`}
                      defaultValue={row.proposedLevelId ?? "leave"}
                      aria-label={`${t("targetLevel")} · ${row.name}`}
                      className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      {levels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.code} · {locale === "en" ? level.label_en : level.label_fr}
                        </option>
                      ))}
                      <option value="leave">{t("leave")}</option>
                    </select>
                  </span>
                </td>
                <td className="py-2">
                  <Input
                    name={`name:${row.classId}`}
                    defaultValue={row.proposedName}
                    maxLength={80}
                    aria-label={`${t("newName")} · ${row.name}`}
                    className="min-h-10"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="confirm" className="size-5 accent-primary" />
        {t("confirm")}
      </label>
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 sm:self-start">{t("submit")}</SubmitButton>
    </form>
  );
}
