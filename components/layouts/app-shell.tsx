import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { BottomNav, TopNav } from "@/components/layouts/bottom-nav";
import { NotificationBell } from "@/components/layouts/notification-bell";
import { PerspectiveSwitcher } from "@/components/layouts/perspective-switcher";
import { InstallPrompt } from "@/components/layouts/pwa";
import { SearchBox } from "@/components/layouts/search-box";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type CurrentUser, initials } from "@/lib/auth/session";
import { appName } from "@/lib/env";
import { getUnreadMessageCount } from "@/server/queries/messaging";

/**
 * Signed-in layout: header with school + perspective, content, five-tab navigation.
 *
 * Width: the page is fluid up to 110rem with breathing padding, and dense pages
 * (messaging, administration) opt into two panes themselves. The old single
 * `max-w-5xl` capped every screen at 1024 px, which left 48 % of a 1920 px
 * display painted with nothing.
 *
 * Header: language and theme live in /plus (they were duplicated here), the tab
 * bar takes over below `lg`, and the search collapses to an icon below `xl` —
 * the header used to budget ~1200 px of content into 992 px, which squeezed the
 * bell and the avatar under the 44 px touch target the project mandates.
 */
export async function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [t, tc, unreadMessages] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getUnreadMessageCount(),
  ]);
  const perspective = user.perspective ?? "parent";

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        {tc("skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto flex h-16 w-full max-w-[110rem] items-center gap-3 px-4 md:px-6 lg:px-8 2xl:px-12">
          <Link href="/accueil" className="flex min-w-0 shrink-0 items-center gap-2.5">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-lg border border-border/70 object-cover"
              priority
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-heading text-lg font-normal tracking-tight">{appName}</span>
              {user.school && (
                <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                  {user.school.name}
                </span>
              )}
            </span>
          </Link>
          <TopNav perspective={perspective} unreadMessages={unreadMessages} />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <SearchBox />
            <SearchBox compact />
            <PerspectiveSwitcher current={perspective} available={user.perspectives} />
            <NotificationBell userId={user.id} />
            <Link
              href="/profil"
              aria-label={t("profile")}
              className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-full"
            >
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
        className="mx-auto w-full max-w-[110rem] flex-1 px-4 pt-6 pb-[calc(var(--nav-h)+1.5rem)] outline-none md:px-6 lg:px-8 lg:pb-12 2xl:px-12"
      >
        {children}
      </main>
      <BottomNav perspective={perspective} unreadMessages={unreadMessages} />
      <InstallPrompt />
    </div>
  );
}
