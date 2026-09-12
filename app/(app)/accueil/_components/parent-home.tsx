import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ChildClassCard } from "@/components/domain/child-class-card";
import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/session";

import { UpcomingEvents } from "@/app/(app)/agenda/_components/upcoming-events";
import { getPendingAcknowledgements } from "@/server/queries/announcements";
import { getMyChildren } from "@/server/queries/family";
import { type TodayItem, getTodayForParent } from "@/server/queries/today";

export async function ParentHome({ user }: { user: CurrentUser }) {
  const [t, format, children, pending, today] = await Promise.all([
    getTranslations("appHome"),
    getFormatter(),
    getMyChildren(),
    getPendingAcknowledgements(user.id),
    getTodayForParent(user.id, user.school?.timezone ?? "Europe/Paris"),
  ]);

  // A receipt owed is the most "today" thing there is, so it heads the list;
  // one owed receipt still goes straight to its announcement, not to a list.
  const items: TodayItem[] = [
    ...pending.map((announcement) => ({
      key: `ack-${announcement.id}`,
      kind: "ack" as const,
      title: announcement.title,
      detail: null,
      href: `/annonces/${announcement.id}`,
      urgent: true,
    })),
    ...today,
  ];

  return (
    <Column rail={<UpcomingEvents userId={user.id} />}>
      <PageHeader
        eyebrow={format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })}
        title={t("greeting", { name: user.profile.first_name })}
        description={t("parent.title")}
      />

      {/* The acknowledgement card used to sit on its own above the list, and it
          is a "today" item like the others: one block, not two. */}
      {/* "Qu'est-ce que je dois savoir aujourd'hui ?" — the only question this
          page has to answer. Everything that merely exists comes after it. */}
      <section className="mb-10">
        <SectionHeader label={t("parent.today")} count={items.length || undefined} />
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-success" aria-hidden />
            {t("parent.todayNothing")}
          </p>
        ) : (
          <RowList>
            {items.map((item) => (
              <Row
                key={item.key}
                href={item.href}
                urgent={item.urgent}
                kind={t(`parent.todayKinds.${item.kind}`)}
                title={item.title}
                detail={item.detail}
              />
            ))}
          </RowList>
        )}
      </section>

      <section>
        <SectionHeader
          label={t("parent.children")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/famille">
                {t("parent.seeFamily")}
                <ChevronRightIcon aria-hidden />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {children.map((child) => (
            <ChildClassCard key={child.student.id} child={child} />
          ))}
        </div>
      </section>
    </Column>
  );
}
