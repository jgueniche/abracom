import {
  BellRingIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  FileSignatureIcon,
  MessageSquareTextIcon,
} from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ChildClassCard } from "@/components/domain/child-class-card";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/session";

import { UpcomingEvents } from "@/app/(app)/agenda/_components/upcoming-events";
import { getPendingAcknowledgements } from "@/server/queries/announcements";
import { getMyChildren } from "@/server/queries/family";
import { type TodayItem, getTodayForParent } from "@/server/queries/today";

const TODAY_ICONS = {
  ack: BellRingIcon,
  homework: BookOpenIcon,
  note: MessageSquareTextIcon,
  signature: FileSignatureIcon,
  event: CalendarDaysIcon,
  attendance: CheckCircle2Icon,
} as const;

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
    <>
      <PageHeader
        eyebrow={format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })}
        title={t("greeting", { name: user.profile.first_name })}
        description={t("parent.title")}
      />

      {/* The acknowledgement card used to sit on its own above the list, and it
          is a "today" item like the others: one block, not two. */}
      {/* "Qu'est-ce que je dois savoir aujourd'hui ?" — the only question this
          page has to answer. Everything that merely exists comes after it. */}
      <section className="mb-8">
        <h2 className="mb-3">{t("parent.today")}</h2>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-success" aria-hidden />
            {t("parent.todayNothing")}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {items.map((item) => {
              const Icon = TODAY_ICONS[item.kind];
              return (
                <li key={item.key} className="border-b border-border/70 last:border-b-0">
                  <Link
                    href={item.href}
                    className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon
                      className={
                        item.urgent
                          ? "size-5 shrink-0 text-brick"
                          : "size-5 shrink-0 text-muted-foreground"
                      }
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        <span className="text-muted-foreground">
                          {t(`parent.todayKinds.${item.kind}`)}
                        </span>
                        {" · "}
                        {item.title}
                      </span>
                      {item.detail && (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      )}
                    </span>
                    <ChevronRightIcon
                      className="ml-auto size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-8 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2>{t("parent.children")}</h2>
            <Button asChild variant="ghost" size="sm" className="min-h-11">
              <Link href="/famille">
                {t("parent.seeFamily")}
                <ChevronRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{t("parent.childrenHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
            {children.map((child) => (
              <ChildClassCard key={child.student.id} child={child} />
            ))}
          </div>
        </section>
        <UpcomingEvents userId={user.id} />
      </div>
    </>
  );
}
