import { BellIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getUnreadNotificationCount } from "@/server/queries/notifications";

export async function NotificationBell({ userId }: { userId: string }) {
  const [t, count] = await Promise.all([
    getTranslations("notifications"),
    getUnreadNotificationCount(userId),
  ]);
  return (
    <Link
      href="/notifications"
      aria-label={t("bell", { count })}
      className="relative inline-flex size-11 items-center justify-center rounded-lg hover:bg-accent hover:text-accent-foreground"
    >
      <BellIcon className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
