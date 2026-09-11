import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";
import { getAdminCounts } from "@/server/queries/school";

import { adminGroupsFor } from "./_components/groups";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

/** Entries whose figure means "something is waiting", not "here is the stock". */
const WAITING = new Set(["reports", "community", "messaging"]);

/**
 * Landing page of the management section.
 *
 * It used to repeat the twelve links of the sidebar shown right beside it, under
 * the same four family names, with a subtitle borrowed from the dashboard —
 * "what is waiting for a decision today" — while nothing on it was a queue.
 * Each entry now carries its own live figure, so the page says something the
 * navigation cannot.
 */
export default async function AdminIndexPage() {
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tNav, tGroups, counts] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.nav"),
    getTranslations("admin.groups"),
    getAdminCounts(schoolId),
  ]);
  const groups = adminGroupsFor(isSchoolAdmin(user.roles, schoolId));

  return (
    <Column>
      <PageHeader title={t("title")} description={t("nav.subtitle")} />
      {/* The column beside this page already lists these twelve destinations.
          What this page adds is the figure next to each one, so it is set as a
          board of figures — four groups, a name, a number — and not as four
          more cards repeating the menu with a pictogram in front of every
          line. */}
      <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
        {groups.map((group) => (
          <section key={group.key}>
            <SectionHeader label={tGroups(group.key)} />
            <ul>
              {group.items.map((item) => {
                const count = counts[item.key];
                const waiting = WAITING.has(item.key) && (count ?? 0) > 0;
                return (
                  <li key={item.href} className="border-b border-rule last:border-b-0">
                    <Link
                      href={item.href}
                      className="-mx-2 flex min-h-11 items-baseline gap-3 rounded-md px-2 text-sm transition-colors hover:bg-muted/50 md:min-h-9"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{tNav(item.key)}</span>
                      {count !== undefined && (
                        <span
                          className={
                            waiting
                              ? "shrink-0 text-sm font-semibold text-brick tabular-nums"
                              : "shrink-0 text-sm text-muted-foreground tabular-nums"
                          }
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Column>
  );
}
