"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// "Fil" was the unfiltered union of Homework and Journal — the same posts
// twice, in a seventh tab that pushed the row past the width of a phone.
const TABS = [
  { segment: "devoirs", key: "homework" },
  { segment: "cahier", key: "journal" },
  { segment: "mots", key: "notes" },
  { segment: "evaluations", key: "assessments" },
  { segment: "absences", key: "absences" },
  { segment: "rdv", key: "appointments" },
] as const;

export function ClassTabs({ classId }: { classId: string }) {
  const t = useTranslations("classSpace.tabs");
  const pathname = usePathname();
  const base = `/classes/${classId}`;
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {TABS.map((tab) => {
          const href = `${base}/${tab.segment}`;
          const active = pathname.startsWith(href);
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
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
