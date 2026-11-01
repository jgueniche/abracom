"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { PracticeLevel } from "@/lib/practice/schema";
import { cn } from "@/lib/utils";
import { requestPracticeSheet } from "@/server/actions/practice-request";

const STAGES = ["reading", "writing", "drawing", "voicing"] as const;
type Stage = (typeof STAGES)[number];

/**
 * While a sheet is being prepared (ADR-0087). Opening the page is the request: a parent who
 * pressed « Pareil » should not have to press again. Then the page reads the row every two
 * seconds and shows the stage the job has written — what is happening, not an animation —
 * until the sheet is there. A failure says so and offers to try again.
 */
export function PracticeWaiting({
  postId,
  level,
  status,
  stage,
  mustRequest,
}: {
  postId: string;
  level: PracticeLevel;
  /** The row as the reader sees it; null when no one has asked yet. */
  status: "pending" | "failed" | null;
  stage: string | null;
  /** No row, or a preparation that was lost: ask (again) on arrival. */
  mustRequest: boolean;
}) {
  const t = useTranslations("practice");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const asked = useRef(false);

  function ask() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestPracticeSheet(postId, level);
      if (result.status === "error") setMessage(result.message);
      router.refresh();
    });
  }

  useEffect(() => {
    if (mustRequest && !asked.current) {
      asked.current = true;
      ask();
    }
    // `ask` is stable enough for a request made once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustRequest]);

  const waiting = !message && (status === "pending" || pending || mustRequest);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => router.refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [waiting, router]);

  if (message) {
    return (
      <div role="status" className="rounded-lg bg-muted px-5 py-4">
        <p className="text-[0.9375rem]">{message}</p>
      </div>
    );
  }

  if (status === "failed" && !pending) {
    return (
      <div role="alert" className="rounded-lg bg-muted px-5 py-4">
        <p className="text-[0.9375rem] font-medium">{t("waiting.failed")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("waiting.failedHint")}</p>
        <Button type="button" className="mt-4 min-h-11 cursor-pointer" onClick={ask}>
          {t("waiting.retry")}
        </Button>
      </div>
    );
  }

  const current = STAGES.indexOf((stage ?? "reading") as Stage);
  return (
    <div aria-busy="true" className="rounded-lg bg-muted px-5 py-5">
      <p className="font-heading text-xl">{t("waiting.title")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("waiting.hint")}</p>
      <ol className="mt-4 space-y-2" aria-live="polite">
        {STAGES.map((value, index) => {
          const done = index < current;
          const now = index === Math.max(current, 0);
          return (
            <li
              key={value}
              className={cn(
                "flex items-center gap-2.5 text-sm",
                done || now ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {done ? (
                <CheckIcon aria-hidden className="size-4 text-success" />
              ) : now ? (
                <LoaderCircleIcon
                  aria-hidden
                  className="size-4 text-primary motion-safe:animate-spin"
                />
              ) : (
                <span aria-hidden className="inline-block size-4" />
              )}
              <span className={cn(now && "font-medium")}>{t(`waiting.stages.${value}`)}</span>
              <span className="sr-only">
                {done ? t("waiting.done") : now ? t("waiting.current") : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
