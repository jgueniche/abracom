import {
  ArchiveIcon,
  ArrowLeftIcon,
  BellIcon,
  BellOffIcon,
  LockIcon,
  LockOpenIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool, isSchoolStaff } from "@/lib/permissions";
import { setThreadState, toggleMute } from "@/server/actions/messaging";
import { getMessages, getThread, searchMessages } from "@/server/queries/messaging";

import { type Member, ThreadView } from "./_components/thread-view";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ threadId }, { q = "" }] = await Promise.all([params, searchParams]);
  const user = await requireCurrentUser();
  const [t, thread] = await Promise.all([getTranslations("messaging"), getThread(threadId)]);
  if (!thread) notFound();

  const me = thread.members.find((m) => m.user_id === user.id) ?? null;
  const isModerator = me?.role === "moderator" || isSchoolStaff(user.roles, thread.school_id);
  const query = q.trim();
  const messages = query ? await searchMessages(threadId, query) : await getMessages(threadId);

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
      : `${thread.class?.name ? `${thread.class.name} · ` : ""}${thread.title ?? t(`kinds.${thread.kind}`)}`;

  const writer = canWriteInSchool(user.roles, thread.school_id);
  let closedReason: string | null = null;
  if (!me) closedReason = t("notAllowed");
  else if (!writer) closedReason = t("composer.readOnly");
  else if (thread.locked || thread.archived) closedReason = t("composer.closed");
  else if (!thread.allow_replies && !isModerator) closedReason = t("readOnlyChannel");
  const canWrite = closedReason === null && !query;
  const showResponseHours =
    thread.kind === "class_official" || (thread.kind === "dm" && other && members.length === 2);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/messages">
          <ArrowLeftIcon aria-hidden />
          {t("title")}
        </Link>
      </Button>
      <PageHeader
        title={title}
        description={`${t(`kinds.${thread.kind}`)} · ${t("members", { count: members.length })}`}
        actions={
          <>
            {me && (
              <form action={toggleMute}>
                <input type="hidden" name="threadId" value={thread.id} />
                <Button type="submit" variant="outline" size="sm" className="min-h-10">
                  {me.muted ? <BellIcon aria-hidden /> : <BellOffIcon aria-hidden />}
                  {me.muted ? t("unmute") : t("mute")}
                </Button>
              </form>
            )}
            {isModerator && (
              <>
                <form action={setThreadState}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <input type="hidden" name="locked" value={String(!thread.locked)} />
                  <Button type="submit" variant="outline" size="sm" className="min-h-10">
                    {thread.locked ? <LockOpenIcon aria-hidden /> : <LockIcon aria-hidden />}
                    {thread.locked ? t("unlock") : t("lock")}
                  </Button>
                </form>
                <form action={setThreadState}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <input type="hidden" name="archived" value={String(!thread.archived)} />
                  <Button type="submit" variant="ghost" size="sm" className="min-h-10">
                    <ArchiveIcon aria-hidden />
                    {thread.archived ? t("unarchive") : t("archive")}
                  </Button>
                </form>
              </>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {thread.locked && <Badge variant="destructive">{t("locked")}</Badge>}
        {thread.archived && <Badge variant="outline">{t("archived")}</Badge>}
        {!thread.allow_replies && <Badge variant="secondary">{t("readOnlyChannel")}</Badge>}
      </div>
      {showResponseHours && (
        <p className="mb-4 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
          {t("responseHours")}
        </p>
      )}
      <form className="mb-4 flex gap-2" role="search">
        <Input
          name="q"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="min-h-10"
        />
        <Button type="submit" variant="outline" className="min-h-10">
          <SearchIcon aria-hidden />
          {t("search")}
        </Button>
        {query && (
          <Button asChild variant="ghost" className="min-h-10">
            <Link href={`/messages/${thread.id}`}>{t("clearSearch")}</Link>
          </Button>
        )}
      </form>
      {query && (
        <p className="mb-3 text-sm text-muted-foreground">
          {t("searchResults", { count: messages.length, query })}
        </p>
      )}
      <ThreadView
        threadId={thread.id}
        initialMessages={messages}
        members={members}
        meId={user.id}
        canWrite={canWrite}
        canModerate={isModerator}
        closedReason={closedReason}
        searchMode={Boolean(query)}
      />
    </>
  );
}
