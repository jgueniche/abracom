import { ContactIcon, MegaphoneIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { HubCard, HubGrid } from "@/components/domain/hub-card";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { getMyTeachingClasses } from "@/server/queries/classes";
import { getClassBirthdays, getClassifieds } from "@/server/queries/community";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community");
  return { title: t("title") };
}

export default async function CommunityPage() {
  const user = await requireCurrentUser();
  const [t, format, children, teaching, classifieds] = await Promise.all([
    getTranslations("community"),
    getFormatter(),
    getMyChildren(),
    getMyTeachingClasses(user.id),
    getClassifieds(),
  ]);
  const classes = new Map<string, string>();
  for (const child of children) {
    const cls = child.student.enrollments[0]?.class;
    if (cls) classes.set(cls.id, cls.name);
  }
  for (const row of teaching) if (row.class) classes.set(row.class.id, row.class.name);
  const birthdayLists = await Promise.all(
    [...classes.entries()].map(async ([id, name]) => ({
      id,
      name,
      rows: await getClassBirthdays(id),
    })),
  );
  const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const birthdays = birthdayLists
    .flatMap((list) => list.rows.map((row) => ({ ...row, className: list.name })))
    .filter((row) => row.next_birthday <= horizon)
    .sort((a, b) => a.next_birthday.localeCompare(b.next_birthday));

  /*
   * Forms used to sit here as well as in École — and École is the screen that
   * links to Communauté, so the same destination was offered twice, one level
   * apart, from the same page. A form is something the *school* asks of you;
   * this hub is what families exchange between themselves.
   */
  const cards = [
    {
      href: "/communaute/annonces",
      icon: MegaphoneIcon,
      title: t("hub.classifieds"),
      hint: t("hub.classifiedsHint"),
      meta: t("hub.published", { count: classifieds.length }),
    },
    {
      href: "/communaute/annuaire",
      icon: ContactIcon,
      title: t("hub.directory"),
      hint: t("hub.directoryHint"),
      meta: null,
    },
  ];

  return (
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {/* The section hubs share one anatomy since session 16; this page kept a
          hand-rolled copy of it, so the same object had two shapes. */}
      <HubGrid className="mb-10">
        {cards.map((card) => (
          <HubCard
            key={card.href}
            href={card.href}
            icon={card.icon}
            title={card.title}
            hint={card.hint}
            meta={card.meta ?? undefined}
          />
        ))}
      </HubGrid>

      <section className="mb-10">
        <SectionHeader label={t("hub.appointments")} hint={t("hub.appointmentsHint")} />
        {classes.size === 0 ? (
          <p className="text-sm text-muted-foreground">{t("hub.noClass")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...classes.entries()].map(([id, name]) => (
              <Link
                key={id}
                href={`/classes/${id}/rdv`}
                className="flex min-h-11 items-center rounded-md border border-border bg-card px-2.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_18%)] hover:text-foreground md:min-h-8"
              >
                {name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader label={t("hub.birthdays")} count={birthdays.length || undefined} />
        {birthdays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("hub.birthdaysEmpty")}</p>
        ) : (
          <ul className="flex flex-col">
            {birthdays.map((row) => (
              <li
                key={`${row.student_id}-${row.className}`}
                className="border-b border-rule py-2 text-sm last:border-b-0"
              >
                {t("hub.birthday", {
                  name: `${row.first_name} (${row.className})`,
                  date: format.dateTime(new Date(`${row.next_birthday}T12:00:00Z`), {
                    dateStyle: "medium",
                  }),
                  age: row.turning,
                })}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Column>
  );
}
