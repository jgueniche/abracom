import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/layouts/account-menu";
import { BottomNav, TopNav } from "@/components/layouts/bottom-nav";
import { HelpIndexProvider } from "@/components/layouts/help-hint";
import { NotificationBell } from "@/components/layouts/notification-bell";
import { PerspectiveSwitcher } from "@/components/layouts/perspective-switcher";
import { InstallPrompt } from "@/components/layouts/pwa";
import { SearchBox } from "@/components/layouts/search-box";
import { type CurrentUser, displayName, initials } from "@/lib/auth/session";
import { helpIndexFor } from "@/lib/help/articles";
import { helpRolesFor } from "@/lib/help/roles";
import { canUseMessaging } from "@/lib/permissions";
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
 * Header: every destination is named in the bar (no "More" tab); the account,
 * help, language and theme hang off the avatar menu. The tab bar takes over
 * below `lg`, and the search collapses to an icon below `xl` — the header used
 * to budget ~1200 px of content into 992 px, which squeezed the bell and the
 * avatar under the 44 px touch target the project mandates.
 */
export async function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [tc, unreadMessages, helpIndex] = await Promise.all([
    getTranslations("common"),
    getUnreadMessageCount(),
    helpIndexFor(helpRolesFor(user.roles)),
  ]);
  const perspective = user.perspective ?? "parent";
  const isParent = user.roles.some((r) => r.role === "parent" || r.role === "guardian");
  // A read-only guardian has no messaging at all: no tab, no "New message".
  const canMessage = user.school ? canUseMessaging(user.roles, user.school.id) : false;
  const showStyleGuide =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-popover focus:px-3 focus:py-2 focus:text-sm focus:shadow-lift"
      >
        {tc("skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background">
        <div className="mx-auto flex h-14 w-full max-w-[110rem] items-stretch gap-3 px-4 md:px-6 lg:h-16 lg:px-8 2xl:px-12">
          <Link
            href="/accueil"
            className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-md py-2"
          >
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={36}
              height={36}
              className="size-8 rounded-md border border-rule object-cover"
              priority
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-heading text-lg leading-tight font-normal tracking-[-0.012em]">
                {appName}
              </span>
              {user.school && (
                <span className="hidden truncate text-[0.6875rem] leading-tight text-muted-foreground sm:inline">
                  {user.school.name}
                </span>
              )}
            </span>
          </Link>
          <TopNav
            perspective={perspective}
            unreadMessages={unreadMessages}
            canMessage={canMessage}
          />
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <SearchBox />
            <SearchBox compact />
            <PerspectiveSwitcher current={perspective} available={user.perspectives} />
            <NotificationBell userId={user.id} />
            <AccountMenu
              name={displayName(user.profile)}
              initials={initials(user.profile)}
              isParent={isParent}
              showStyleGuide={showStyleGuide}
            />
          </div>
        </div>
      </header>
      <main
        id="contenu"
        tabIndex={-1}
        className="mx-auto w-full max-w-[110rem] flex-1 px-4 pt-6 pb-[calc(var(--nav-h)+1.5rem)] outline-none md:px-6 lg:px-8 lg:pt-8 lg:pb-14 2xl:px-12"
      >
        {/* The index the "?" of every page header looks the current path up in. */}
        <HelpIndexProvider articles={helpIndex}>{children}</HelpIndexProvider>
      </main>
      <BottomNav
        perspective={perspective}
        unreadMessages={unreadMessages}
        canMessage={canMessage}
      />
      <InstallPrompt />
    </div>
  );
}
