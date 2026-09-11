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
      className="relative inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-9"
    >
      <BellIcon className="size-[1.0625rem]" aria-hidden />
      {count > 0 && (
        <span className="absolute top-1 right-1 min-w-[15px] rounded-full bg-brick px-1 text-center text-[0.625rem] leading-[15px] font-semibold text-brick-foreground md:top-0.5 md:right-0.5">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
