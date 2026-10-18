"use client";

import { ChevronDownIcon } from "lucide-react";
import { Link } from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { adminGroupsFor } from "./groups";

export function AdminNav({ isAdmin, isPlatform }: { isAdmin: boolean; isPlatform: boolean }) {
  const t = useTranslations("admin.nav");
  const tg = useTranslations("admin.groups");
  const tAdmin = useTranslations("admin");
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const groups = adminGroupsFor(isAdmin, isPlatform);
  const current = groups.flatMap((g) => g.items).find((item) => isActive(item.href));

  return (
    <>
      {/* Phone and tablet: folded. Four open families cost about 830 px — the
          whole first screen — before the title of the page you asked for. */}
      <details className="mb-5 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg bg-muted px-3 text-sm font-medium">
          <span className="eyebrow">{tAdmin("title")}</span>
          <span className="min-w-0 flex-1 truncate">
            {current ? t(current.key) : tAdmin("nav.all")}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </summary>
        <nav aria-label={tAdmin("title")} className="mt-3 flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="eyebrow mb-1.5">{tg(group.key)}</p>
              <ul className="-ml-2.5 flex flex-wrap gap-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
                        isActive(item.href)
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground",
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
      </details>

      {/* Desktop: a real column — every destination readable at a glance. */}
      <nav
        aria-label={tAdmin("title")}
        className="sticky top-20 hidden h-fit flex-col gap-6 lg:flex"
      >
        {groups.map((group) => (
          <div key={group.key}>
            <p className="eyebrow mb-2">{tg(group.key)}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-9 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-muted font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-primary"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground",
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
