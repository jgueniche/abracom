"use client";

import {
  BackpackIcon,
  BuildingIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  HouseIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  NotebookPenIcon,
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
  | "homework"
  | "myChild"
  | "myClass"
  | "messages"
  | "school"
  | "publish"
  | "dashboard"
  | "manage"
  | "agenda"
  | "attendance";

type Item = {
  href: string;
  label: Label;
  icon: typeof HouseIcon;
  badge?: boolean;
  /** Used by the phone bar, where a fifth of 390 px has to hold one line. */
  short?: Label;
};

/**
 * One bar per role — a parent consults, a teacher publishes, the direction
 * processes a queue, and they were all given the same five tabs.
 *
 * Every destination is named: the sixth tab used to be a "More" catch-all
 * holding the profile, help and preferences, which are now behind the header
 * avatar (AccountMenu). The slot it frees goes to Devoirs — the diary is the
 * reason a parent opens the app on a weekday evening, so it is a tab, not a
 * page buried three taps inside a class.
 *
 * "Classe" is a parent tab too: the class space (feed, cahier de vie, mots,
 * absences) was reachable only through "Mon enfant" — a page about allergies
 * and image rights — which put the daily content two screens deep. The child
 * record itself is what moves out, to the desktop bar and the avatar menu.
 *
 * "École" gathers everything the school sends or asks for (announcements,
 * circulars, agenda, forms): announcements are the first product objective and
 * used to live inside a card titled "My account", behind "More". It is a
 * teacher tab as well — it used to appear only from `lg` up, so on a phone an
 * teacher had no route at all to the announcements and the circulars, in an
 * app whose first objective is that very channel. Publishing takes its desktop
 * slot: it is already one tap from the home screen ("Nouveau devoir"), from the
 * class space ("Nouvelle publication") and from the Devoirs tab.
 */
const ITEMS: Record<Perspective, Item[]> = {
  parent: [
    { href: "/accueil", label: "home", icon: HouseIcon },
    { href: "/devoirs", label: "homework", icon: NotebookPenIcon },
    { href: "/classes", label: "myClass", icon: SchoolIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon, badge: true },
    { href: "/ecole", label: "school", icon: BuildingIcon },
  ],
  teacher: [
    { href: "/accueil", label: "home", icon: HouseIcon },
    { href: "/devoirs", label: "homework", icon: NotebookPenIcon },
    { href: "/classes", label: "myClass", icon: SchoolIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon, badge: true },
    { href: "/ecole", label: "school", icon: BuildingIcon },
  ],
  admin: [
    { href: "/accueil", label: "dashboard", icon: LayoutDashboardIcon, short: "home" },
    { href: "/publier", label: "publish", icon: SquarePenIcon },
    { href: "/messages", label: "messages", icon: MessageCircleIcon, badge: true },
    { href: "/ecole", label: "school", icon: BuildingIcon },
    { href: "/admin", label: "manage", icon: SettingsIcon },
  ],
};

/** Fills the slot a read-only guardian frees by having no messaging at all. */
const AGENDA: Item = { href: "/agenda", label: "agenda", icon: CalendarDaysIcon };

/**
 * The pointeuse. The phone bar is full at five named tabs, and the person about
 * to point is standing in the entrance hall, so the one-tap route on a phone is
 * the card on the home screen; the desktop bar, which has room, names it.
 */
const ATTENDANCE: Item = { href: "/pointage", label: "attendance", icon: ClipboardCheckIcon };

/**
 * Destinations that do not fit the five mobile tabs but belong in the desktop
 * bar, where there is room to name everything (the header must be complete).
 */
const DESKTOP_EXTRA: Record<Perspective, Item[]> = {
  parent: [AGENDA, { href: "/famille", label: "myChild", icon: BackpackIcon }],
  teacher: [{ href: "/publier", label: "publish", icon: SquarePenIcon }, AGENDA, ATTENDANCE],
  admin: [AGENDA, ATTENDANCE],
};

/** The bar this reader actually gets: no messaging entry for a read-only guardian. */
function itemsFor(perspective: Perspective, canMessage: boolean): Item[] {
  const items = ITEMS[perspective];
  if (canMessage) return items;
  return items.map((item) => (item.href === "/messages" ? AGENDA : item));
}

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
  canMessage = true,
}: {
  perspective: Perspective;
  unreadMessages?: number;
  canMessage?: boolean;
}) {
  const t = useTranslations("nav");
  const isActive = useActive();

  return (
    <nav
      aria-label={t("home")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {itemsFor(perspective, canMessage).map(({ href, label, short, icon: Icon, badge }) => {
          const active = isActive(href);
          const count = badge ? unreadMessages : 0;
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={count > 0 ? t("unreadMessages", { count }) : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {count > 0 && <Count value={count} />}
                </span>
                {/* "Tableau de bord" wrapped onto two lines and spilled out of
                    its column, over the page behind the bar, on every screen
                    of the direction. */}
                <span className="max-w-full truncate">{t(short ?? label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The same destinations from `lg` up, plus the ones the mobile bar cannot fit. */
export function TopNav({
  perspective,
  unreadMessages = 0,
  canMessage = true,
}: {
  perspective: Perspective;
  unreadMessages?: number;
  canMessage?: boolean;
}) {
  const t = useTranslations("nav");
  const isActive = useActive();
  const items = itemsFor(perspective, canMessage);
  const extra = DESKTOP_EXTRA[perspective].filter(
    (candidate) => !items.some((item) => item.href === candidate.href),
  );

  return (
    <nav aria-label={t("home")} className="hidden items-center gap-0.5 lg:flex">
      {[...items, ...extra].map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(href);
        const count = badge ? unreadMessages : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={count > 0 ? t("unreadMessages", { count }) : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground xl:px-3",
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
