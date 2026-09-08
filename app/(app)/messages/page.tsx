import { BellOffIcon, ChevronRightIcon, LockIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getMyThreads, type ThreadSummary } from "@/server/queries/messaging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messaging");
  return { title: t("title") };
}

function threadTitle(thread: ThreadSummary, dmFallback: string): string {
  if (thread.kind === "dm")
    return (
      [thread.other_first_name, thread.other_last_name].filter(Boolean).join(" ") || dmFallback
    );
  if (thread.class_name) return `${thread.class_name} · ${thread.title ?? ""}`.replace(/ · $/, "");
  return thread.title ?? dmFallback;
}

export default async function MessagesPage() {
  await requireCurrentUser();
  const [t, format, threads] = await Promise.all([
    getTranslations("messaging"),
    getFormatter(),
    getMyThreads(),
  ]);
  const active = threads.filter((th) => !th.archived);
  const archived = threads.filter((th) => th.archived);

  const item = (thread: ThreadSummary) => (
    <li key={thread.thread_id}>
      <Link
        href={`/messages/${thread.thread_id}`}
        className={cn(
          "flex items-center gap-3 rounded-xl border p-3 hover:bg-accent/60",
          thread.unread_count > 0 && "border-primary/40 bg-primary/5",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn("truncate", thread.unread_count > 0 ? "font-semibold" : "font-medium")}
            >
              {threadTitle(thread, t("kinds.dm"))}
            </p>
            <Badge variant="outline">{t(`kinds.${thread.kind}`)}</Badge>
            {thread.muted && (
              <BellOffIcon className="size-4 text-muted-foreground" aria-label={t("muted")} />
            )}
            {thread.locked && (
              <LockIcon className="size-4 text-muted-foreground" aria-label={t("locked")} />
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {thread.last_message_preview
              ? `${thread.last_author_first_name ? `${thread.last_author_first_name} : ` : ""}${thread.last_message_preview}`
              : "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {thread.last_message_at && (
            <span className="text-xs text-muted-foreground">
              {format.relativeTime(new Date(thread.last_message_at))}
            </span>
          )}
          {thread.unread_count > 0 && <Badge>{thread.unread_count}</Badge>}
        </div>
        <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild className="min-h-11">
            <Link href="/messages/nouveau">
              <PlusIcon aria-hidden />
              {t("new")}
            </Link>
          </Button>
        }
      />
      {threads.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-2">{active.map(item)}</ul>
          {archived.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                {t("archived")} ({archived.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-2">{archived.map(item)}</ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}
