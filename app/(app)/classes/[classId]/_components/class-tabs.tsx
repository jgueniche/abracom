"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

// "Fil" was the unfiltered union of Homework and Journal — the same posts
// twice, in a seventh tab that pushed the row past the width of a phone.
const TABS = [
  { segment: "devoirs", key: "homework" },
  // The weekly grid: the first of the three reasons a family kept Educartable
  // open beside Kesher (session 20).
  { segment: "emploi-du-temps", key: "timetable" },
  { segment: "cahier", key: "journal" },
  { segment: "mots", key: "notes" },
  { segment: "evaluations", key: "assessments" },
  { segment: "absences", key: "absences" },
  // Staff reading only: lateness across a class is not a family view.
  { segment: "retards", key: "late" },
  { segment: "rdv", key: "appointments" },
] as const;

/**
 * The row used to show the same six tabs to everyone. The secretariat, which has
 * no access to skills assessments, and a read-only guardian, who has none either,
 * both got an "Évaluations" tab that opened on a wall of text or an empty grid —
 * on the guardian's side, six lines under "Access in read-only mode (no
 * assessments, no messaging)". A tab that exists to say no is not a tab.
 */
export function ClassTabs({
  classId,
  showAssessments,
  showLate,
}: {
  classId: string;
  showAssessments: boolean;
  /** Lateness adds up two registers across the whole class: a staff reading. */
  showLate: boolean;
}) {
  const t = useTranslations("classSpace.tabs");
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const base = `/classes/${classId}`;

  // The row scrolls sideways on a phone: without this, opening "Évaluations" or
  // "Rendez-vous" left the selected pill cut off past the right edge.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const tabs = TABS.filter(
    (tab) =>
      (tab.segment !== "evaluations" || showAssessments) && (tab.segment !== "retards" || showLate),
  );

  return (
    // Tabs, drawn as tabs: a rule under the row and a mark under the one you
    // are on. The row used to be eight filled pills, which read as eight
    // buttons competing with the page's actual action.
    <nav className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-0.5 border-b border-rule">
        {tabs.map((tab) => {
          const href = `${base}/${tab.segment}`;
          const active = pathname.startsWith(href);
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center px-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
                  active
                    ? "text-foreground after:absolute after:inset-x-1.5 after:-bottom-px after:h-[2px] after:rounded-full after:bg-primary"
                    : "text-muted-foreground hover:text-foreground",
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
