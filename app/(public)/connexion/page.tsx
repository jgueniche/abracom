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
      <div className="flex flex-col gap-2">
        <p className="font-heading text-lg font-semibold text-primary">{appName}</p>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>
      {!configured && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {t("notConfigured")}
        </p>
      )}
      <LoginForm
        next={safeNextPath(next)}
        initialError={error === "link" ? t("linkError") : undefined}
      />
      {/* Accounts are created by the school, never self-served: this says so
          where someone without one looks, instead of leaving them to guess. */}
      <details className="rounded-2xl border border-border bg-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium">
          <InfoIcon className="size-4 shrink-0 text-primary" aria-hidden />
          {t("noAccountCta")}
        </summary>
        <p className="border-t border-border px-4 py-3 text-sm text-pretty text-muted-foreground">
          {t("noAccount")}
        </p>
      </details>
    </div>
  );
}
