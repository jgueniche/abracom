import { ChevronDownIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SchoolLogo } from "@/components/domain/school-logo";
import { Link } from "@/components/ui/link";
import { safeNextPath, TEST_SPACE_PATH } from "@/lib/auth/routes";
import { appName, publicEnv } from "@/lib/env";
import { REGISTRATION_EMAIL, registrationMailto } from "@/lib/registration";

import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

/**
 * The first page every family sees (ADR-0085).
 *
 * It was a form alone in the middle of a white page — no logo, no school, nothing to say
 * where one had arrived: the porteur's « un tout petit peu trop fade ». The school's logo now
 * opens the page, large, on a quiet wash: beside the form on a wide screen, above it on a
 * phone, where the button still sits inside the first screen (844 px). The three short bars
 * under it are the logo's own colours — the teal of the aleph, the gold and the red of the
 * star — and nothing else on the page is decoration.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth.login");
  const configured = Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL);

  return (
    <div className="grid w-full flex-1 items-stretch gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
      <section
        aria-label={t("brandLabel")}
        className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted px-6 pt-7 pb-6 text-center lg:gap-6 lg:px-10 lg:py-14"
      >
        {/* A soft light behind the logo, so that it reads as placed rather than pasted. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_42%,var(--background),transparent)] opacity-80 dark:opacity-0"
        />
        <SchoolLogo
          alt={t("logoAlt")}
          priority
          className="relative w-44 sm:w-52 lg:w-[22rem] xl:w-[24rem]"
        />
        <div className="relative flex flex-col items-center gap-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-1 w-7 rounded-full bg-brand-teal" />
            <span className="h-1 w-7 rounded-full bg-brand-gold" />
            <span className="h-1 w-7 rounded-full bg-brand-red" />
          </span>
          <p className="font-heading text-lg text-balance text-foreground lg:text-2xl">
            {t("tagline")}
          </p>
          {appName === "Kesher" && (
            <p className="hidden text-xs text-muted-foreground lg:block">{t("brandCaption")}</p>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[23rem] flex-col gap-6 lg:self-center">
        <div className="flex flex-col">
          <h1 className="font-heading text-3xl lg:text-[2.125rem] lg:leading-tight">
            {t("welcome", { appName })}
          </h1>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">{t("subtitle")}</p>
        </div>
        {!configured && (
          <p
            role="status"
            className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground"
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
        <details className="group -mx-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 text-sm font-medium text-foreground/80 hover:text-foreground">
            {t("noAccountCta")}
            <ChevronDownIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="flex flex-col gap-1 px-1 pt-1">
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
          className="-mt-3 inline-flex min-h-11 items-center self-end text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("testSpace")}
        </Link>
      </div>
    </div>
  );
}
