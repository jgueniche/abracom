import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/domain/user-avatar";
import { levelLabel } from "@/lib/levels";
import type { ChildWithClass } from "@/server/queries/family";

/** The four places a parent actually goes inside a class space. */
const SHORTCUTS = [
  { segment: "devoirs", key: "homework" },
  { segment: "cahier", key: "journal" },
  { segment: "mots", key: "notes" },
  { segment: "absences", key: "absences" },
] as const;

/**
 * One child, one class, one tap.
 *
 * The class space used to be reachable only by opening "Mon enfant" and finding
 * a link inside the child's record — so the feed, the cahier de vie and the
 * individual notes, which are the daily content, sat two screens deep behind a
 * page about allergies and image rights.
 */
export async function ChildClassCard({ child }: { child: ChildWithClass }) {
  const [t, tTabs, locale] = await Promise.all([
    getTranslations("family"),
    getTranslations("classSpace.tabs"),
    getLocale(),
  ]);
  const { student } = child;
  const cls = student.enrollments[0]?.class ?? null;
  const name = `${student.first_name} ${student.last_name}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <Link
        href={cls ? `/classes/${cls.id}/devoirs` : "/famille"}
        className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/40"
      >
        <UserAvatar
          name={name}
          initials={`${student.first_name.charAt(0)}${student.last_name.charAt(0)}`}
          className="size-11"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-sm text-muted-foreground">
            {cls
              ? `${cls.name}${cls.level ? ` · ${levelLabel(cls.level, locale)}` : ""}`
              : t("noClass")}
          </span>
        </span>
        <ChevronRightIcon className="ml-auto size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {cls && (
        <nav aria-label={cls.name} className="flex flex-wrap gap-1 border-t border-border p-2">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.key}
              href={`/classes/${cls.id}/${shortcut.segment}`}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {tTabs(shortcut.key)}
            </Link>
          ))}
        </nav>
      )}
    </article>
  );
}
