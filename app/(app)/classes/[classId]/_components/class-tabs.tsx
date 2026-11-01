"use client";

import { Link } from "@/components/ui/link";
import { ChevronDownIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { LinkPending } from "@/components/layouts/link-pending";
import { TabPrefetch, usePrefetchOnIntent } from "@/components/layouts/tab-prefetch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  refreshKey,
}: {
  classId: string;
  showAssessments: boolean;
  /** Lateness adds up two registers across the whole class: a staff reading. */
  showLate: boolean;
  /** When the class layout was rendered: changes after a mutation (ADR-0084). */
  refreshKey?: number;
}) {
  const t = useTranslations("classSpace.tabs");
  const intent = usePrefetchOnIntent();
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

  const [everyday, ...rest] = groups;
  const follow = rest.flatMap((group) => group.tabs);
  const activeFollow = follow.find((tab) => pathname.startsWith(`${base}/${tab.segment}`));

  // One row of tabs (ADR-0081). The two families used to be two rows, each named by a small
  // label and each scrolling sideways: three rows of navigation, filters included, before the
  // first page of the journal. The record kept on each pupil — absences, lateness,
  // competencies, meetings — is opened less often and now sits behind « Suivi ».
  return (
    <nav aria-label={t("aria")} className="-mx-1 flex items-stretch">
      {/* The everyday family is loaded before it is clicked, like the main bar (ADR-0076). */}
      <TabPrefetch
        hrefs={GROUPS[0].tabs.map((tab) => `${base}/${tab.segment}`)}
        refreshKey={refreshKey}
      />
      {/* One scrolling row, « Suivi » included: kept apart at the right, it made a phone's row
          look complete while « Emploi du temps » was hidden in the scrolled part. */}
      <ul className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto overflow-y-hidden">
        {(everyday?.tabs ?? []).map((tab) => {
          const href = `${base}/${tab.segment}`;
          const active = pathname.startsWith(href);
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={href}
                prefetch={false}
                {...intent(href)}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                {t(tab.key)}
                {!active && <LinkPending className="inset-x-2 bottom-0" />}
              </Link>
            </li>
          );
        })}
        {follow.length > 0 && (
          <li className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(tabClass(Boolean(activeFollow)), "shrink-0 gap-1 outline-none")}
                aria-current={activeFollow ? "page" : undefined}
              >
                {activeFollow ? t(activeFollow.key) : t("groupFollow")}
                <ChevronDownIcon aria-hidden className="size-4 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {follow.map((tab) => (
                  <DropdownMenuItem key={tab.key} asChild className="min-h-11 cursor-pointer">
                    <Link
                      href={`${base}/${tab.segment}`}
                      prefetch={false}
                      {...intent(`${base}/${tab.segment}`)}
                    >
                      {t(tab.key)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </ul>
    </nav>
  );
}

/** A tab: a mark under the one you are on, never a filled pill (ADR-0054). */
function tabClass(active: boolean) {
  return cn(
    "relative flex min-h-11 items-center px-3 text-[0.9375rem] whitespace-nowrap transition-colors",
    active
      ? "font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-primary"
      : "font-medium text-foreground/70 hover:text-foreground",
  );
}
