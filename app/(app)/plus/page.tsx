import {
  BellIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FolderIcon,
  MegaphoneIcon,
  PaletteIcon,
  ShieldCheckIcon,
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
import { isSchoolStaff } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("more");
  return { title: t("title") };
}

const linkClass =
  "hover:bg-accent hover:text-accent-foreground flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium";

export default async function MorePage() {
  const user = await requireCurrentUser();
  const [t, tNav] = await Promise.all([getTranslations("more"), getTranslations("nav")]);
  const isParent = user.roles.some((r) => r.role === "parent" || r.role === "guardian");
  const isStaff = user.school ? isSchoolStaff(user.roles, user.school.id) : false;
  const showStyleGuide =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-6 md:grid-cols-2">
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
            <Link href="/annonces" className={linkClass}>
              <MegaphoneIcon className="size-4" aria-hidden />
              {tNav("announcements")}
              <ChevronRightIcon className="ml-auto size-4" aria-hidden />
            </Link>
            <Link href="/documents" className={linkClass}>
              <FolderIcon className="size-4" aria-hidden />
              {tNav("documents")}
              <ChevronRightIcon className="ml-auto size-4" aria-hidden />
            </Link>
            <Link href="/notifications" className={linkClass}>
              <BellIcon className="size-4" aria-hidden />
              {tNav("notifications")}
              <ChevronRightIcon className="ml-auto size-4" aria-hidden />
            </Link>
            {isStaff && (
              <Link href="/admin" className={linkClass}>
                <ShieldCheckIcon className="size-4" aria-hidden />
                {tNav("admin")}
                <ChevronRightIcon className="ml-auto size-4" aria-hidden />
              </Link>
            )}
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
        <div className="flex flex-col gap-6">
          <Card>
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
                <ExternalLinkIcon className="size-4" aria-hidden />
                <span className="flex flex-col">
                  {t("educartable")}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("educartableHint")}
                  </span>
                </span>
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("preferences")}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                {t("language")} <LocaleSwitcher />
              </div>
              <div className="flex items-center gap-2 text-sm">
                {t("theme")} <ThemeToggle />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
