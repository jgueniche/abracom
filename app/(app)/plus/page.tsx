import {
  BellIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  PaletteIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/layouts/locale-switcher";
import { PageHeader } from "@/components/layouts/page-header";
import { SignOutButton } from "@/components/layouts/sign-out-button";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("more");
  return { title: t("title") };
}

const linkClass =
  "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground";

/**
 * Account and preferences only.
 *
 * This page used to hold Announcements, Documents and Community inside a card
 * titled "My account" — the three main institutional contents, with no other
 * entry point in the navigation. They now live under the "École" tab, and
 * language and theme (which were duplicated in the header) live only here.
 */
export default async function MorePage() {
  const user = await requireCurrentUser();
  const [t, tNav] = await Promise.all([getTranslations("more"), getTranslations("nav")]);
  const isParent = user.roles.some((r) => r.role === "parent" || r.role === "guardian");
  const showStyleGuide =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("account")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <Link href="/profil" className={linkClass}>
              <UserRoundIcon className="size-4" aria-hidden />
              {tNav("profile")}
              <ChevronRightIcon className="ml-auto size-4" aria-hidden />
            </Link>
            {isParent && (
              <Link href="/famille" className={linkClass}>
                <UsersRoundIcon className="size-4" aria-hidden />
                {tNav("family")}
                <ChevronRightIcon className="ml-auto size-4" aria-hidden />
              </Link>
            )}
            <Link href="/notifications" className={linkClass}>
              <BellIcon className="size-4" aria-hidden />
              {tNav("notifications")}
              <ChevronRightIcon className="ml-auto size-4" aria-hidden />
            </Link>
            <Link href="/aide" className={linkClass}>
              <BookOpenIcon className="size-4" aria-hidden />
              {t("help")}
              <ChevronRightIcon className="ml-auto size-4" aria-hidden />
            </Link>
            {showStyleGuide && (
              <Link href="/dev/ui" className={linkClass}>
                <PaletteIcon className="size-4" aria-hidden />
                {tNav("styleGuide")}
                <ChevronRightIcon className="ml-auto size-4" aria-hidden />
              </Link>
            )}
            <div className="mt-3">
              <SignOutButton className="min-h-11 w-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("school")}</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={publicEnv.NEXT_PUBLIC_EDUCARTABLE_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <ExternalLinkIcon className="size-4 shrink-0" aria-hidden />
              <span className="flex flex-col">
                {t("educartable")}
                <span className="text-xs font-normal text-muted-foreground">
                  {t("educartableHint")}
                </span>
              </span>
            </a>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("preferences")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              {t("language")} <LocaleSwitcher />
            </div>
            <div className="flex items-center gap-2 text-sm">
              {t("theme")} <ThemeToggle />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
