"use client";

import {
  CalendarDaysIcon,
  HouseIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  MenuIcon,
  MessageCircleIcon,
  SchoolIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Perspective } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: "home" | "classes" | "messages" | "agenda" | "more" | "dashboard" | "announcements";
  icon: typeof HouseIcon;
};

const ITEMS: Record<Perspective, Item[]> = {
  parent: [
    { href: "/accueil", label: "home", icon: HouseIcon },
    { href: "/classes", label: "classes", icon: SchoolIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon },
    { href: "/agenda", label: "agenda", icon: CalendarDaysIcon },
    { href: "/plus", label: "more", icon: MenuIcon },
  ],
  teacher: [
    { href: "/accueil", label: "home", icon: HouseIcon },
    { href: "/classes", label: "classes", icon: SchoolIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon },
    { href: "/agenda", label: "agenda", icon: CalendarDaysIcon },
    { href: "/plus", label: "more", icon: MenuIcon },
  ],
  admin: [
    { href: "/accueil", label: "dashboard", icon: LayoutDashboardIcon },
    { href: "/annonces", label: "announcements", icon: MegaphoneIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon },
    { href: "/agenda", label: "agenda", icon: CalendarDaysIcon },
    { href: "/plus", label: "more", icon: MenuIcon },
  ],
};

/** Five-tab bottom navigation (brief §8), ≥ 44 px targets, safe-area aware. */
export function BottomNav({ perspective }: { perspective: Perspective }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("home")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS[perspective].map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Same destinations as a horizontal bar for tablet / desktop. */
export function TopNav({ perspective }: { perspective: Perspective }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("home")} className="hidden items-center gap-1 md:flex">
      {ITEMS[perspective].map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
