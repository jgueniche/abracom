import { CheckCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead } from "@/server/actions/notifications";
import { getNotifications } from "@/server/queries/notifications";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

function linkFor(kind: string, payload: Record<string, unknown>): string | null {
  if (kind.startsWith("announcement.") && typeof payload.announcement_id === "string") {
    return `/annonces/${payload.announcement_id}`;
  }
  return null;
}

export default async function NotificationsPage() {
  const user = await requireCurrentUser();
  const [t, format, notifications] = await Promise.all([
    getTranslations("notifications"),
    getFormatter(),
    getNotifications(user.id),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" className="min-h-11">
              <CheckCheckIcon aria-hidden />
              {t("markAllRead")}
            </Button>
          </form>
        }
      />
      {notifications.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const payload = (n.payload ?? {}) as Record<string, unknown>;
            const label =
              n.kind === "announcement.reminder"
                ? t("kinds.announcementReminder", { title: String(payload.title ?? "") })
                : t("kinds.default");
            const href = linkFor(n.kind, payload);
            const body = (
              <div
                className={cn(
                  "rounded-xl border p-3",
                  !n.read_at && "border-primary/40 bg-primary/5",
                )}
              >
                <p className="font-medium">{label}</p>
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
    </>
  );
}
