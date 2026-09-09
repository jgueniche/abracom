"use client";

import {
  BackpackIcon,
  HouseIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MessageCircleIcon,
  SchoolIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Perspective } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Label =
  | "home"
  | "myChild"
  | "myClass"
  | "messages"
  | "school"
  | "publish"
  | "dashboard"
  | "manage"
  | "more";

type Item = { href: string; label: Label; icon: typeof HouseIcon; badge?: boolean };

/**
 * One bar per role — a parent consults, a teacher publishes, the direction
 * processes a queue, and they were all given the same five tabs.
 *
 * "École" gathers everything the school sends or asks for (announcements,
 * circulars, agenda, forms): announcements are the first product objective and
 * used to live inside a card titled "My account", behind "More".
 */
const ITEMS: Record<Perspective, Item[]> = {
  parent: [
    { href: "/accueil", label: "home", icon: HouseIcon },
    { href: "/famille", label: "myChild", icon: BackpackIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon, badge: true },
    { href: "/ecole", label: "school", icon: SchoolIcon },
    { href: "/plus", label: "more", icon: MenuIcon },
  ],
  teacher: [
    { href: "/accueil", label: "home", icon: HouseIcon },
    { href: "/classes", label: "myClass", icon: SchoolIcon },
    { href: "/publier", label: "publish", icon: SquarePenIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon, badge: true },
    { href: "/plus", label: "more", icon: MenuIcon },
  ],
  admin: [
    { href: "/accueil", label: "dashboard", icon: LayoutDashboardIcon },
    { href: "/publier", label: "publish", icon: SquarePenIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon, badge: true },
    { href: "/admin", label: "manage", icon: SettingsIcon },
    { href: "/plus", label: "more", icon: MenuIcon },
  ],
};

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function Count({ value }: { value: number }) {
  return (
    <span className="absolute top-0 -right-2 min-w-4 rounded-full bg-brick px-1 text-center text-[10px] leading-4 font-semibold text-brick-foreground">
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** Five-tab bottom navigation (brief §8), ≥ 44 px targets, safe-area aware. */
export function BottomNav({
  perspective,
  unreadMessages = 0,
}: {
  perspective: Perspective;
  unreadMessages?: number;
}) {
  const t = useTranslations("nav");
  const isActive = useActive();

  return (
    <nav
      aria-label={t("home")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS[perspective].map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          const count = badge ? unreadMessages : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={count > 0 ? t("unreadMessages", { count }) : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {count > 0 && <Count value={count} />}
                </span>
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Same destinations as a horizontal bar from `lg` up. */
export function TopNav({
  perspective,
  unreadMessages = 0,
}: {
  perspective: Perspective;
  unreadMessages?: number;
}) {
  const t = useTranslations("nav");
  const isActive = useActive();

  return (
    <nav aria-label={t("home")} className="hidden items-center gap-1 lg:flex">
      {ITEMS[perspective].map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(href);
        const count = badge ? unreadMessages : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={count > 0 ? t("unreadMessages", { count }) : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(label)}
            {count > 0 && (
              <span className="min-w-4 rounded-full bg-brick px-1 text-center text-[10px] leading-4 font-semibold text-brick-foreground">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
