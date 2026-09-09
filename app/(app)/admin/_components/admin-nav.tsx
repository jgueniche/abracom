"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Twelve flat pills measured 1 372 px: on any screen, finding "Journal" meant
 * scrolling sideways — including on a 1 920 px display with 928 px of empty
 * space beside it. Four named families, a real sidebar from `lg` up.
 */
const GROUPS = [
  {
    key: "publications",
    items: [
      { href: "/admin/annonces", key: "announcements" },
      { href: "/admin/documents", key: "documents" },
      { href: "/admin/evenements", key: "events" },
      { href: "/admin/formulaires", key: "forms" },
    ],
  },
  {
    key: "people",
    items: [
      { href: "/admin/familles", key: "families" },
      { href: "/admin/classes", key: "classes" },
      { href: "/admin/utilisateurs", key: "members" },
      { href: "/admin/import", key: "import" },
    ],
  },
  {
    key: "moderation",
    items: [
      { href: "/admin/signalements", key: "reports" },
      { href: "/admin/communaute", key: "community" },
    ],
  },
  {
    key: "year",
    items: [
      { href: "/admin/annees", key: "years" },
      { href: "/admin/journal", key: "audit" },
    ],
  },
] as const;

export function AdminNav() {
  const t = useTranslations("admin.nav");
  const tg = useTranslations("admin.groups");
  const tAdmin = useTranslations("admin");
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Phone and tablet: one scroller per family, so the groups survive. */}
      <nav aria-label={tAdmin("title")} className="-mx-4 mb-6 px-4 lg:hidden">
        <div className="flex flex-col gap-3">
          {GROUPS.map((group) => (
            <div key={group.key}>
              <p className="eyebrow mb-1.5">{tg(group.key)}</p>
              <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {group.items.map((item) => (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                        isActive(item.href)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {t(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Desktop: a real column — all twelve destinations readable at a glance. */}
      <nav
        aria-label={tAdmin("title")}
        className="sticky top-20 hidden h-fit flex-col gap-5 rounded-2xl border border-border bg-surface/60 p-4 lg:flex"
      >
        {GROUPS.map((group) => (
          <div key={group.key}>
            <p className="eyebrow mb-2">{tg(group.key)}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center rounded-lg px-3 text-sm font-medium",
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
