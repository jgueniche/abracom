"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", key: "feed" },
  { segment: "devoirs", key: "homework" },
  { segment: "cahier", key: "journal" },
  { segment: "mots", key: "notes" },
  { segment: "absences", key: "absences" },
] as const;

export function ClassTabs({ classId }: { classId: string }) {
  const t = useTranslations("classSpace.tabs");
  const pathname = usePathname();
  const base = `/classes/${classId}`;
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = tab.segment ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-full border px-4 text-sm font-medium",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
