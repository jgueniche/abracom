import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { safeNextPath } from "@/lib/auth/routes";
import { appName, publicEnv } from "@/lib/env";

import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth.login");
  const configured = Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <p className="eyebrow mb-2 text-primary/85">{appName}</p>
        <h1>{t("title")}</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>
      {!configured && (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground"
        >
          {t("notConfigured")}
        </p>
      )}
      <LoginForm
        next={safeNextPath(next)}
        initialError={error === "link" ? t("linkError") : undefined}
      />
      {/* Accounts are created by the school, never self-served: this says so
          where someone without one looks, instead of leaving them to guess. */}
      <details className="rounded-lg border border-border bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[0.8125rem] font-medium">
          <InfoIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {t("noAccountCta")}
        </summary>
        <p className="border-t border-rule px-3.5 py-2.5 text-xs text-pretty text-muted-foreground">
          {t("noAccount")}
        </p>
      </details>
    </div>
  );
}
