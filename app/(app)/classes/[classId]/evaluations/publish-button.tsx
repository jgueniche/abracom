"use client";

import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { publishAssessments } from "@/server/actions/assessments";

export function PublishButton({
  classId,
  periodId,
  pending,
}: {
  classId: string;
  periodId: string;
  pending: number;
}) {
  const t = useTranslations("assessments");
  return (
    <form
      action={publishAssessments}
      onSubmit={(event) => {
        if (!window.confirm(t("publishConfirm"))) event.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="periodId" value={periodId} />
      <Button type="submit" disabled={pending === 0} className="min-h-11">
        <SendIcon aria-hidden />
        {t("publish")}
      </Button>
      <span className="text-sm text-muted-foreground">{t("draftCount", { count: pending })}</span>
    </form>
  );
}
