import { Link } from "@/components/ui/link";
import { getLocale, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/domain/user-avatar";
import { levelLabel } from "@/lib/levels";
import type { ChildWithClass } from "@/server/queries/family";

/** The four places a parent actually goes inside a class space. */
const SHORTCUTS = [
  { segment: "cahier", key: "journal" },
  { segment: "devoirs", key: "homework" },
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

  // No frame and no inner rule (ADR-0078): the avatar is the left edge, as in Messages, and the
  // four places to go are words under the name rather than a toolbar under a line.
  return (
    <article className="flex items-start gap-3">
      <Link
        prefetch={false}
        href={cls ? `/classes/${cls.id}` : "/famille"}
        className="shrink-0 rounded-full"
        tabIndex={-1}
        aria-hidden
      >
        <UserAvatar
          name={name}
          initials={`${student.first_name.charAt(0)}${student.last_name.charAt(0)}`}
          className="size-10"
        />
      </Link>
      <div className="flex min-w-0 flex-col">
        <Link
          prefetch={false}
          href={cls ? `/classes/${cls.id}` : "/famille"}
          className="flex min-h-6 items-center text-[0.9375rem] font-semibold hover:underline hover:decoration-foreground/25 hover:underline-offset-[3px]"
        >
          {name}
        </Link>
        <span className="meta truncate">
          {cls
            ? `${cls.name}${cls.level ? ` · ${levelLabel(cls.level, locale)}` : ""}`
            : t("noClass")}
        </span>
        {cls && (
          <nav aria-label={cls.name} className="-ml-2 flex flex-wrap gap-x-0.5">
            {SHORTCUTS.map((shortcut) => (
              <Link
                prefetch={false}
                key={shortcut.key}
                href={`/classes/${cls.id}/${shortcut.segment}`}
                className="flex min-h-11 items-center rounded-md px-2 text-[0.8125rem] font-medium text-primary transition-colors hover:bg-muted md:min-h-9"
              >
                {tTabs(shortcut.key)}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </article>
  );
}
