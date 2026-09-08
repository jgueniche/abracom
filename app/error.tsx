"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.unexpected");

  useEffect(() => {
    // Reported to Sentry in session 14; never shown to the user (no stack traces in the UI).
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button onClick={reset} className="min-h-11">
        {t("retry")}
      </Button>
    </main>
  );
}
