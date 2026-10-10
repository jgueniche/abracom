import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/components/ui/link";
import { safeNextPath, TEST_SPACE_PATH } from "@/lib/auth/routes";
import { appName, publicEnv } from "@/lib/env";
import { REGISTRATION_EMAIL, registrationMailto } from "@/lib/registration";

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
          where someone without one looks, names the address to write to, and
          lays the message out so that it holds what a registration needs. */}
      <details className="rounded-lg border border-border bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[0.8125rem] font-medium">
          <InfoIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {t("noAccountCta")}
        </summary>
        <div className="flex flex-col gap-1 border-t border-rule px-3.5 pt-2.5 pb-1">
          <p className="text-xs text-pretty text-muted-foreground">{t("noAccount")}</p>
          <a
            href={registrationMailto(
              t("registrationSubject", { appName }),
              t("registrationBody", { appName }),
            )}
            className="inline-flex min-h-11 items-center self-start text-sm font-medium break-all text-primary underline underline-offset-4"
          >
            {REGISTRATION_EMAIL}
          </a>
        </div>
      </details>
      {/* The test school's door, for whoever was given its password (ADR-0073). */}
      <Link
        href={TEST_SPACE_PATH}
        className="inline-flex min-h-11 items-center self-end text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("testSpace")}
      </Link>
    </div>
  );
}
