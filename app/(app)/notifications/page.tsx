import { BellIcon } from "lucide-react";
import { CheckCheckIcon, SettingsIcon } from "lucide-react";
import type { Metadata } from "next";
import { Link } from "@/components/ui/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { renderNotification } from "@/lib/notifications/render";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead } from "@/server/actions/notifications";
import { getNotifications } from "@/server/queries/notifications";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const user = await requireCurrentUser();
  const [t, tk, format, notifications] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("notifications.kinds"),
    getFormatter(),
    getNotifications(user.id),
  ]);

  return (
    <Column>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button asChild variant="ghost" className="min-h-11">
              <Link href="/notifications/preferences">
                <SettingsIcon aria-hidden />
                {t("preferences")}
              </Link>
            </Button>
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="outline" className="min-h-11">
                <CheckCheckIcon aria-hidden />
                {t("markAllRead")}
              </Button>
            </form>
          </>
        }
      />
      {notifications.length === 0 ? (
        <EmptyState
          icon={BellIcon}
          title={t("empty")}
          description={t("emptyHint")}
          action={{ href: "/notifications/preferences", label: t("preferences") }}
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {notifications.map((n) => {
            const payload = (n.payload ?? {}) as Record<string, unknown>;
            const rendered = renderNotification(n.kind, payload, (key, values) =>
              tk(key as never, values as never),
            );
            const label = rendered.title;
            const href = rendered.href;
            const body = (
              // Unread is said by weight and a dot in the margin, the way Messages says it — not by
              // a tinted, framed panel (ADR-0078).
              <div
                className={cn(
                  "relative -mx-3 rounded-lg px-3 py-2.5",
                  href && "transition-colors hover:bg-muted",
                )}
              >
                {!n.read_at && (
                  <span
                    aria-hidden
                    className="absolute top-4 left-0 size-1.5 -translate-x-1/2 rounded-full bg-primary"
                  />
                )}
                <p className={cn(n.read_at ? "font-medium" : "font-semibold")}>{label}</p>
                {rendered.body && <p className="text-sm text-muted-foreground">{rendered.body}</p>}
                <p className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(n.created_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            );
            return <li key={n.id}>{href ? <Link href={href}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </Column>
  );
}
