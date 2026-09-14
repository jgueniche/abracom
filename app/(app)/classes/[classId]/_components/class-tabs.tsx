"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { LinkPending } from "@/components/layouts/link-pending";
import { cn } from "@/lib/utils";

// "Fil" was the unfiltered union of Homework and Journal — the same posts
// twice, in a seventh tab that pushed the row past the width of a phone.
/**
 * Eight destinations in one flat, sideways-scrolling row read as a heap: the
 * teacher who reviewed this space called it "un peu bordélique", and she was
 * right — a class space holds two different jobs and the row said so nowhere.
 *
 * **Classe** is the everyday: what the class lives, what it prepares, what is
 * said to one family, when it happens. **Suivi** is the record kept on each
 * pupil: presence, lateness, competencies, the meeting where they are
 * discussed. Inside each family the order is still how often the tab is opened,
 * not the order the features were built (ADR-0059).
 */
const GROUPS = [
  {
    key: "class",
    tabs: [
      { segment: "cahier", key: "journal" },
      { segment: "devoirs", key: "homework" },
      { segment: "mots", key: "notes" },
      // The weekly grid: the first of the three reasons a family kept
      // Educartable open beside Kesher (session 20).
      { segment: "emploi-du-temps", key: "timetable" },
    ],
  },
  {
    key: "follow",
    tabs: [
      { segment: "absences", key: "absences" },
      // Staff reading only: lateness across a class is not a family view.
      { segment: "retards", key: "late" },
      { segment: "evaluations", key: "assessments" },
      { segment: "rdv", key: "appointments" },
    ],
  },
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

  // A row still scrolls sideways on a narrow phone: without this, opening
  // "Rendez-vous" left the selected tab cut off past the right edge.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const groups = GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter(
      (tab) =>
        (tab.segment !== "evaluations" || showAssessments) &&
        (tab.segment !== "retards" || showLate),
    ),
  })).filter((group) => group.tabs.length > 0);

  return (
    // Tabs, drawn as tabs: a rule under each family and a mark under the one
    // you are on. The row used to be eight filled pills, which read as eight
    // buttons competing with the page's actual action — and then, once they
    // were quiet, the opposite fault: 13 px of muted grey under card titles
    // set at 18 px. Navigation is the layer a reader needs at a glance; the
    // content is read once they have arrived. This row is now the larger of
    // the two.
    <nav aria-label={t("aria")} className="-mx-4 mb-7 flex flex-col px-4">
      {groups.map((group) => (
        <div key={group.key} className="flex items-stretch gap-3 border-b border-border">
          <span className="eyebrow flex shrink-0 items-center">
            {t(`group${group.key === "class" ? "Class" : "Follow"}`)}
          </span>
          <ul className="flex flex-1 gap-1 overflow-x-auto">
            {group.tabs.map((tab) => {
              const href = `${base}/${tab.segment}`;
              const active = pathname.startsWith(href);
              return (
                <li key={tab.key} className="shrink-0">
                  <Link
                    href={href}
                    ref={active ? activeRef : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-12 items-center px-3 text-[0.9375rem] whitespace-nowrap transition-colors",
                      active
                        ? "font-semibold text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:bg-primary"
                        : "font-medium text-foreground/70 hover:text-foreground",
                    )}
                  >
                    {t(tab.key)}
                    {!active && <LinkPending className="inset-x-2 -bottom-px" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
