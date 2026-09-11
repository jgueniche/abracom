"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { adminGroupsFor } from "./groups";

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("admin.nav");
  const tg = useTranslations("admin.groups");
  const tAdmin = useTranslations("admin");
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const groups = adminGroupsFor(isAdmin);
  const current = groups.flatMap((g) => g.items).find((item) => isActive(item.href));

  return (
    <>
      {/* Phone and tablet: folded. Four open families cost about 830 px — the
          whole first screen — before the title of the page you asked for. */}
      <details className="mb-5 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium">
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
              <ul className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-md border px-2.5 text-[0.8125rem] font-medium transition-colors",
                        isActive(item.href)
                          ? "border-primary/45 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
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
        className="sticky top-20 hidden h-fit flex-col gap-5 rounded-xl border border-border bg-card p-3.5 lg:flex"
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
                      "relative flex min-h-8 items-center rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-muted font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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
