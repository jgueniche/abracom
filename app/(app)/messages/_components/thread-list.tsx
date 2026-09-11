import { BellOffIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/domain/user-avatar";
import { cn } from "@/lib/utils";
import type { ThreadSummary } from "@/server/queries/messaging";

export function threadTitle(thread: ThreadSummary, kindLabel: (kind: string) => string): string {
  if (thread.kind === "dm")
    return (
      [thread.other_first_name, thread.other_last_name].filter(Boolean).join(" ") || kindLabel("dm")
    );
  // class threads keep a generic title in the database: the label follows the user's language
  const title =
    thread.kind === "class_group" || thread.kind === "class_official"
      ? kindLabel(thread.kind)
      : (thread.title ?? kindLabel(thread.kind));
  if (thread.class_name) return `${thread.class_name} · ${title}`;
  return title;
}

function monogram(thread: ThreadSummary, title: string): string {
  if (thread.kind === "dm")
    return (
      `${thread.other_first_name?.charAt(0) ?? ""}${thread.other_last_name?.charAt(0) ?? ""}`.toUpperCase() ||
      "?"
    );
  return (thread.class_name ?? title).slice(0, 3).toUpperCase();
}

/**
 * Conversations grouped by what they are, official channel first.
 *
 * The list was sorted purely on `last_message_at`, so the class's official
 * channel — the one that carries what the school actually says — sank under
 * whatever chat had moved most recently.
 */
export async function ThreadList({
  threads,
  activeId,
  className,
}: {
  threads: ThreadSummary[];
  activeId?: string;
  className?: string;
}) {
  const [t, format] = await Promise.all([getTranslations("messaging"), getFormatter()]);
  const live = threads.filter((thread) => !thread.archived);
  const archived = threads.filter((thread) => thread.archived);

  const sections = [
    { key: "officialPinned", rows: live.filter((th) => th.kind === "class_official") },
    {
      key: "classThreads",
      rows: live.filter((th) => th.kind !== "class_official" && th.kind !== "dm"),
    },
    { key: "directMessages", rows: live.filter((th) => th.kind === "dm") },
  ].filter((section) => section.rows.length > 0);

  const item = (thread: ThreadSummary) => {
    const title = threadTitle(thread, (kind) => t(`kinds.${kind}`));
    const unread = thread.unread_count > 0;
    const active = thread.thread_id === activeId;
    return (
      <li key={thread.thread_id}>
        <Link
          href={`/messages/${thread.thread_id}`}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:bg-muted/60",
            active && "border-border bg-card",
          )}
        >
          <UserAvatar
            initials={monogram(thread, title)}
            name={title}
            className={cn("size-9", thread.kind !== "dm" && "text-[0.625rem]")}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                {title}
              </p>
              {thread.muted && (
                <BellOffIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label={t("muted")}
                />
              )}
              {thread.locked && (
                <LockIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label={t("locked")}
                />
              )}
              {thread.last_message_at && (
                <span className="ml-auto shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                  {format.relativeTime(new Date(thread.last_message_at))}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  "truncate text-[0.8125rem]",
                  unread ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {thread.last_message_preview
                  ? `${thread.last_author_first_name ? `${thread.last_author_first_name} : ` : ""}${thread.last_message_preview}`
                  : "—"}
              </p>
              {unread && (
                <span className="ml-auto min-w-[17px] shrink-0 rounded-full bg-brick px-1 text-center text-[0.625rem] leading-[17px] font-semibold text-brick-foreground tabular-nums">
                  {thread.unread_count > 99 ? "99+" : thread.unread_count}
                </span>
              )}
            </div>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {sections.map((section) => (
        <div key={section.key}>
          <p className="eyebrow mb-1.5 px-2.5">{t(section.key)}</p>
          <ul className="flex flex-col gap-0.5">{section.rows.map(item)}</ul>
        </div>
      ))}
      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer px-2.5 text-[0.8125rem] text-muted-foreground">
            {t("archived")} ({archived.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">{archived.map(item)}</ul>
        </details>
      )}
    </div>
  );
}
