import { ArrowLeftIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/domain/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool, isSchoolStaff } from "@/lib/permissions";
import { getMessages, getMyThreads, getThread, searchMessages } from "@/server/queries/messaging";

import { ThreadList } from "../_components/thread-list";
import { ThreadMenu } from "./_components/thread-menu";
import { type Member, ThreadView } from "./_components/thread-view";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ q?: string; recherche?: string }>;
}) {
  const [{ threadId }, search] = await Promise.all([params, searchParams]);
  const user = await requireCurrentUser();
  const [t, format, thread, threads] = await Promise.all([
    getTranslations("messaging"),
    getFormatter(),
    getThread(threadId),
    getMyThreads(),
  ]);
  if (!thread) notFound();

  const me = thread.members.find((m) => m.user_id === user.id) ?? null;
  const isModerator = me?.role === "moderator" || isSchoolStaff(user.roles, thread.school_id);
  const query = (search.q ?? "").trim();
  const searchOpen = query.length > 0 || search.recherche === "1";
  const [messages, results] = await Promise.all([
    getMessages(threadId),
    query ? searchMessages(threadId, query) : Promise.resolve([]),
  ]);

  const members: Member[] = thread.members
    .filter((m) => m.profile)
    .map((m) => ({
      id: m.user_id,
      name: `${m.profile!.first_name} ${m.profile!.last_name}`.trim(),
      initials:
        `${m.profile!.first_name.charAt(0)}${m.profile!.last_name.charAt(0)}`.toUpperCase() || "?",
      role: m.role,
    }));
  const other = thread.kind === "dm" ? members.find((m) => m.id !== user.id) : undefined;
  const title =
    thread.kind === "dm"
      ? (other?.name ?? t("kinds.dm"))
      : `${thread.class?.name ? `${thread.class.name} · ` : ""}${
          thread.kind === "class_group" || thread.kind === "class_official"
            ? t(`kinds.${thread.kind}`)
            : (thread.title ?? t(`kinds.${thread.kind}`))
        }`;

  const writer = canWriteInSchool(user.roles, thread.school_id);
  let closedReason: string | null = null;
  if (!me) closedReason = t("notAllowed");
  else if (!writer) closedReason = t("composer.readOnly");
  else if (thread.locked || thread.archived) closedReason = t("composer.closed");
  else if (!thread.allow_replies && !isModerator) closedReason = t("readOnlyChannel");
  // Searching used to flip this to false: the composer vanished mid-conversation
  // with no explanation of why.
  const canWrite = closedReason === null;
  const showResponseHours =
    thread.kind === "class_official" || (thread.kind === "dm" && other && members.length === 2);

  return (
    <div className="lg:grid lg:h-[calc(100dvh-9.5rem)] lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
      {/* Opening a thread used to replace the list entirely, even on a 27-inch screen. */}
      <aside className="hidden min-h-0 overflow-y-auto pr-1 lg:block">
        <ThreadList threads={threads} activeId={thread.id} />
      </aside>

      <div className="flex min-h-0 flex-col">
        {/* One conversation bar instead of five stacked header blocks. */}
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
          <Link
            href="/messages"
            aria-label={t("backToList")}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
          >
            <ArrowLeftIcon className="size-5" aria-hidden />
          </Link>
          <UserAvatar
            name={title}
            initials={
              thread.kind === "dm"
                ? (other?.initials ?? "?")
                : (thread.class?.name ?? title).slice(0, 3).toUpperCase()
            }
            className={thread.kind === "dm" ? "size-10" : "size-10 text-[0.625rem]"}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-lg leading-tight font-normal tracking-tight sm:text-xl">
              {title}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t(`kinds.${thread.kind}`)} · {t("members", { count: members.length })}
              {thread.last_message_at &&
                ` · ${format.relativeTime(new Date(thread.last_message_at))}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* State belongs under the bar, not inside it: on a 390 px screen
                these badges pushed the title and the menu off the screen. */}
            <div className="hidden items-center gap-1 sm:flex">
              {thread.locked && <Badge variant="destructive">{t("locked")}</Badge>}
              {thread.archived && <Badge variant="outline">{t("archived")}</Badge>}
            </div>
            <ThreadMenu
              threadId={thread.id}
              isMember={me !== null}
              muted={me?.muted ?? false}
              locked={thread.locked}
              archived={thread.archived}
              canModerate={isModerator}
              searchHref={`/messages/${thread.id}?recherche=1`}
            />
          </div>
        </div>

        {(thread.locked || thread.archived) && (
          <div className="mb-3 flex flex-wrap gap-1 sm:hidden">
            {thread.locked && <Badge variant="destructive">{t("locked")}</Badge>}
            {thread.archived && <Badge variant="outline">{t("archived")}</Badge>}
          </div>
        )}

        {/* Search is an overlay on the conversation, not a replacement for it. */}
        {searchOpen && (
          <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-soft">
            <form className="flex gap-2" role="search">
              <Input
                name="q"
                defaultValue={query}
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                className="min-h-11"
                autoFocus
              />
              <Button type="submit" variant="outline" className="min-h-11">
                <SearchIcon aria-hidden />
                <span className="sr-only sm:not-sr-only">{t("search")}</span>
              </Button>
              <Button asChild variant="ghost" className="min-h-11">
                <Link href={`/messages/${thread.id}`} aria-label={t("clearSearch")}>
                  <XIcon aria-hidden />
                </Link>
              </Button>
            </form>
            {query && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("searchResults", { count: results.length, query })}
                </p>
                <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {results.map((result) => {
                    const author = members.find((m) => m.id === result.author_id);
                    return (
                      <li key={result.id}>
                        <a
                          href={`#m-${result.id}`}
                          className="flex flex-col rounded-lg px-2 py-1.5 hover:bg-accent"
                        >
                          <span className="text-xs text-muted-foreground">
                            {author?.name ?? t("message.unknown")} ·{" "}
                            {format.dateTime(new Date(result.created_at), { dateStyle: "medium" })}
                          </span>
                          <span className="line-clamp-2 text-sm">{result.body}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        <ThreadView
          threadId={thread.id}
          initialMessages={messages}
          members={members}
          meId={user.id}
          canWrite={canWrite}
          canModerate={isModerator}
          closedReason={closedReason}
          searchMode={false}
          lastReadAt={me?.last_read_at ?? null}
          hint={showResponseHours ? t("responseHours") : undefined}
        />
      </div>
    </div>
  );
}
