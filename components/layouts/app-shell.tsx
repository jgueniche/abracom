import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { BottomNav, TopNav } from "@/components/layouts/bottom-nav";
import { LocaleSwitcher } from "@/components/layouts/locale-switcher";
import { NotificationBell } from "@/components/layouts/notification-bell";
import { PerspectiveSwitcher } from "@/components/layouts/perspective-switcher";
import { InstallPrompt } from "@/components/layouts/pwa";
import { SearchBox } from "@/components/layouts/search-box";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type CurrentUser, initials } from "@/lib/auth/session";
import { appName } from "@/lib/env";

/** Signed-in layout: header with school + perspective, content, five-tab navigation. */
export async function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [t, tc] = await Promise.all([getTranslations("nav"), getTranslations("common")]);
  const perspective = user.perspective ?? "parent";

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        {tc("skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/accueil" className="flex min-w-0 items-center gap-2">
            <span className="font-heading text-lg font-semibold tracking-tight">{appName}</span>
            {user.school && (
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                · {user.school.name}
              </span>
            )}
          </Link>
          <TopNav perspective={perspective} />
          <div className="flex items-center gap-1">
            <SearchBox />
            <SearchBox compact />
            <PerspectiveSwitcher current={perspective} available={user.perspectives} />
            <NotificationBell userId={user.id} />
            <LocaleSwitcher />
            <ThemeToggle />
            <Link href="/profil" aria-label={t("profile")} className="ml-1">
              <Avatar className="size-9">
                <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                  {initials(user.profile)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>
      <main
        id="contenu"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 outline-none md:pb-10"
      >
        {children}
      </main>
      <BottomNav perspective={perspective} />
      <InstallPrompt />
    </div>
  );
}
