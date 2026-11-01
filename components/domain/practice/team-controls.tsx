"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
import {
  discardPracticeSheet,
  setClassPractice,
  setPracticeSheetHidden,
} from "@/server/actions/practice-team";

/**
 * What the team of the class can do with a sheet (ADR-0087): withdraw it from the families
 * (and put it back), throw it away so that a new one is prepared, close the feature for the
 * class. Each is checked and written to the audit log by the database.
 */
export function TeamControls({
  sheetId,
  postId,
  classId,
  hidden,
}: {
  sheetId: string;
  postId: string;
  classId: string;
  hidden: boolean;
}) {
  const t = useTranslations("practice.team");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function run(action: () => Promise<{ status: string }>) {
    setError(false);
    start(async () => {
      const result = await action();
      if (result.status !== "success") setError(true);
      router.refresh();
    });
  }

  return (
    <section className="no-print mt-10" aria-labelledby="practice-team">
      <SectionHeader id="practice-team" label={t("label")} />
      {hidden && <p className="mb-3 text-sm">{t("hiddenNotice")}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          disabled={pending}
          onClick={() => run(() => setPracticeSheetHidden(sheetId, !hidden, postId))}
        >
          {hidden ? t("show") : t("hide")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          disabled={pending}
          onClick={() => run(() => discardPracticeSheet(sheetId, postId))}
        >
          {t("discard")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 cursor-pointer"
          disabled={pending}
          onClick={() => run(() => setClassPractice(classId, false, postId))}
        >
          {t("closeClass")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("discardHint")}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t("error")}
        </p>
      )}
    </section>
  );
}

/** The class switch alone, where there is no sheet to act on (the homework page). */
export function ClassPracticeSwitch({
  classId,
  postId,
  enabled,
  label,
}: {
  classId: string;
  postId: string;
  enabled: boolean;
  label: string;
}) {
  const t = useTranslations("practice.team");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 cursor-pointer"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setClassPractice(classId, !enabled, postId);
            setError(result.status !== "success");
            router.refresh();
          })
        }
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {t("error")}
        </span>
      )}
    </>
  );
}
