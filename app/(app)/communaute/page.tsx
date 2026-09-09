import {
  CakeIcon,
  CalendarCheckIcon,
  ClipboardListIcon,
  ContactIcon,
  MegaphoneIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { getMyTeachingClasses } from "@/server/queries/classes";
import { getClassBirthdays, getClassifieds, getForms } from "@/server/queries/community";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community");
  return { title: t("title") };
}

export default async function CommunityPage() {
  const user = await requireCurrentUser();
  const [t, format, children, teaching, classifieds, forms] = await Promise.all([
    getTranslations("community"),
    getFormatter(),
    getMyChildren(),
    getMyTeachingClasses(user.id),
    getClassifieds(),
    getForms(),
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
  const toAnswer = forms.filter((f) => f.responses.length === 0).length;
  const staff = user.school !== null && isSchoolStaff(user.roles, user.school.id);

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
    {
      href: "/communaute/formulaires",
      icon: ClipboardListIcon,
      title: t("hub.forms"),
      hint: t("hub.formsHint"),
      meta: staff ? null : t("hub.openForms", { count: toAnswer }),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full transition-colors group-hover:bg-accent/40">
              <CardHeader className="flex flex-row items-start gap-3">
                <card.icon className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.hint}</CardDescription>
                  {card.meta && (
                    <p className="mt-2 text-sm font-medium text-primary">{card.meta}</p>
                  )}
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Card className="h-full">
          <CardHeader className="flex flex-row items-start gap-3">
            <CalendarCheckIcon className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <CardTitle>{t("hub.appointments")}</CardTitle>
              <CardDescription>{t("hub.appointmentsHint")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {classes.size === 0 ? (
              <p className="text-sm text-muted-foreground">{t("hub.noClass")}</p>
            ) : (
              [...classes.entries()].map(([id, name]) => (
                <Link
                  key={id}
                  href={`/classes/${id}/rdv`}
                  className="flex min-h-11 items-center rounded-full border px-4 text-sm font-medium hover:bg-accent"
                >
                  {name}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-start gap-3">
            <CakeIcon className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <CardTitle>{t("hub.birthdays")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {birthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("hub.birthdaysEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {birthdays.map((row) => (
                  <li key={`${row.student_id}-${row.className}`}>
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}
