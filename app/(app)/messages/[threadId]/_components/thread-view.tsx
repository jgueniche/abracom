"use client";

import {
  CameraIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CornerDownRightIcon,
  FileTextIcon,
  FlagIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PaperclipIcon,
  ReplyIcon,
  SendIcon,
  ShieldXIcon,
  SmilePlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  type Ref,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { UserAvatar } from "@/components/domain/user-avatar";
import { useUploads } from "@/components/forms/use-uploads";
import { MessageAttachments, useSignedPhotos } from "./message-attachments";
import { PollCard, type ThreadPollView } from "./poll-card";
import { PollComposer } from "./poll-composer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  dayKey,
  isPhoto,
  parseAttachments,
  REACTION_EMOJIS,
  segmentMentions,
} from "@/lib/messaging/format";
import { IMAGE_EDGES, messageFolder, UPLOAD_LIMITS } from "@/lib/uploads/shared";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  deleteOwnMessage,
  fetchOlderMessages,
  markThreadRead,
  moderateMessage,
  reportMessage,
  type SendState,
  sendMessage,
  toggleReaction,
} from "@/server/actions/messaging";

export type Member = { id: string; name: string; initials: string; role: "member" | "moderator" };
export type Message = {
  id: string;
  thread_id: string;
  author_id: string | null;
  body: string;
  attachments: unknown;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  moderated_by: string | null;
  moderation_reason: string | null;
  created_at: string;
  reactions: Array<{ user_id: string; emoji: string }>;
};

const initialSend: SendState = { status: "idle" };
/** Messages from the same author inside this window share one header. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** How close to the bottom counts as "following the conversation". */
const STICK_TO_BOTTOM_PX = 120;

type Row =
  | { kind: "day"; key: string; day: string }
  | { kind: "unread"; key: string }
  | { kind: "message"; key: string; message: Message; startsGroup: boolean };

export function ThreadView({
  threadId,
  schoolId,
  signedUrls,
  initialMessages,
  members,
  meId,
  canWrite,
  canModerate,
  closedReason,
  closedNote,
  searchMode,
  lastReadAt,
  hint,
  polls = [],
}: {
  threadId: string;
  schoolId: string;
  /** Photos of the first page of messages, signed with the page. */
  signedUrls: Record<string, string>;
  initialMessages: Message[];
  members: Member[];
  meId: string;
  canWrite: boolean;
  canModerate: boolean;
  /** Polls of this conversation, rendered under the message that announced them. */
  polls?: ThreadPollView[];
  closedReason: string | null;
  /** What to do meanwhile — the emergency contact the direction typed herself. */
  closedNote?: string | null;
  searchMode: boolean;
  /** Where the reader stopped last time — draws the "new messages" line. */
  lastReadAt: string | null;
  /** Response-hours line, shown as the composer's help text instead of a banner. */
  hint?: string;
}) {
  const t = useTranslations("messaging");
  const format = useFormatter();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reason, setReason] = useState<{ id: string; mode: "report" | "moderate" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(!searchMode && initialMessages.length >= 60);
  const [loadingOlder, startLoadOlder] = useTransition();
  const [unseen, setUnseen] = useState(0);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const composerRef = useRef<{ focus: () => void }>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const memberNames = useMemo(() => members.map((m) => m.name), [members]);
  const memberLabels = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const photoPaths = useMemo(
    () =>
      messages.flatMap((message) =>
        message.deleted_at
          ? []
          : parseAttachments(message.attachments)
              .filter(isPhoto)
              .flatMap((photo) => (photo.thumb ? [photo.path, photo.thumb] : [photo.path])),
      ),
    [messages],
  );
  const photos = useSignedPhotos(signedUrls, photoPaths);
  const pollsByMessage = useMemo(() => {
    const index = new Map<string, ThreadPollView>();
    for (const poll of polls) if (poll.messageId) index.set(poll.messageId, poll);
    return index;
  }, [polls]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  /** True while the reader is parked at the end of the conversation. */
  const isAtBottom = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return true;
    // On phones the conversation is not its own scroll container: the page is.
    if (scroller.scrollHeight <= scroller.clientHeight + 1) {
      return window.innerHeight + window.scrollY >= document.body.scrollHeight - STICK_TO_BOTTOM_PX;
    }
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_TO_BOTTOM_PX;
  }, []);

  /**
   * Only report the thread as read when it is actually being looked at.
   * It used to be marked read on mount, so a notification tapped and dismissed
   * from a pocket cleared the whole conversation.
   */
  const markReadIfVisible = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (!isAtBottom()) return;
    void markThreadRead(threadId);
  }, [isAtBottom, threadId]);

  // Realtime: new / edited / deleted messages and reactions (RLS filters what we may receive).
  useEffect(() => {
    if (searchMode) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removed = payload.old as { id?: string };
            setMessages((current) => current.filter((m) => m.id !== removed.id));
            return;
          }
          const row = payload.new as Omit<Message, "reactions">;
          setMessages((current) => {
            const existing = current.find((m) => m.id === row.id);
            if (existing)
              return current.map((m) =>
                m.id === row.id ? { ...m, ...row, reactions: m.reactions } : m,
              );
            return [...current, { ...row, reactions: [] }];
          });
          if (row.author_id !== meId && !isAtBottom()) setUnseen((n) => n + 1);
          markReadIfVisible();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as {
            message_id?: string;
            user_id?: string;
            emoji?: string;
          };
          if (!row.message_id || !row.user_id || !row.emoji) return;
          setMessages((current) =>
            current.map((m) => {
              if (m.id !== row.message_id) return m;
              const without = m.reactions.filter(
                (r) => !(r.user_id === row.user_id && r.emoji === row.emoji),
              );
              return {
                ...m,
                reactions:
                  payload.eventType === "DELETE"
                    ? without
                    : [...without, { user_id: row.user_id!, emoji: row.emoji! }],
              };
            }),
          );
        },
      )
      // A tally is shared state: when someone answers a poll, everyone reading
      // the thread should see the bar move. Votes carry no payload we can merge
      // locally, so the server component re-renders with the fresh counts.
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () =>
        router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thread_polls", filter: `thread_id=eq.${threadId}` },
        () => router.refresh(),
      )
      .subscribe();
    markReadIfVisible();
    document.addEventListener("visibilitychange", markReadIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", markReadIfVisible);
      void supabase.removeChannel(channel);
    };
  }, [threadId, searchMode, meId, isAtBottom, markReadIfVisible, router]);

  /**
   * To the very end of the conversation. On a phone the page scrolls, not the thread, and the
   * composer is pinned over its last lines: bringing the end marker into view left the last
   * message — and the photos it carries — under the composer.
   */
  const scrollToEnd = useCallback((behavior: ScrollBehavior = "auto") => {
    const scroller = scrollerRef.current;
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      return;
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  }, []);

  // Follow the conversation only when the reader is already at the end of it.
  useEffect(() => {
    if (searchMode) return;
    if (!atBottomRef.current) return;
    scrollToEnd();
  }, [messages.length, searchMode, scrollToEnd]);

  function onScroll() {
    atBottomRef.current = isAtBottom();
    if (atBottomRef.current && unseen > 0) {
      setUnseen(0);
      markReadIfVisible();
    }
  }

  function jumpToBottom() {
    scrollToEnd("smooth");
    setUnseen(0);
  }

  function loadOlder() {
    const oldest = messages[0];
    if (!oldest) return;
    startLoadOlder(async () => {
      const older = (await fetchOlderMessages(threadId, oldest.created_at)) as Message[];
      if (older.length === 0) {
        setHasOlder(false);
        return;
      }
      setHasOlder(older.length >= 40);
      setMessages((current) => [...older, ...current]);
    });
  }

  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());

  /** Day separators, the resume line and author grouping, in one pass. */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let currentDay: string | null = null;
    let unreadDrawn = false;
    let previous: Message | null = null;
    for (const message of messages) {
      const day = dayKey(message.created_at);
      if (day !== currentDay) {
        out.push({ kind: "day", key: `day-${day}`, day });
        currentDay = day;
        previous = null;
      }
      if (
        !unreadDrawn &&
        !searchMode &&
        lastReadAt !== null &&
        message.author_id !== meId &&
        message.created_at > lastReadAt
      ) {
        out.push({ kind: "unread", key: "unread" });
        unreadDrawn = true;
        previous = null;
      }
      const startsGroup =
        previous === null ||
        previous.author_id !== message.author_id ||
        new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() >
          GROUP_WINDOW_MS;
      out.push({ kind: "message", key: message.id, message, startsGroup });
      previous = message;
    }
    return out;
  }, [messages, lastReadAt, meId, searchMode]);

  const reasonTarget = reason ? messages.find((m) => m.id === reason.id) : undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 lg:overflow-y-auto lg:px-1"
      >
        {hasOlder && !searchMode && (
          <div className="mb-4 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={loadOlder}
              disabled={loadingOlder}
            >
              <ChevronUpIcon aria-hidden />
              {t("loadOlder")}
            </Button>
          </div>
        )}
        <ol className="flex flex-col">
          {rows.map((row) => {
            if (row.kind === "day")
              return (
                <li key={row.key} className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[0.6875rem] font-medium tracking-[0.085em] text-muted-foreground uppercase">
                    {row.day === today
                      ? t("today")
                      : row.day === yesterday
                        ? t("yesterday")
                        : format.dateTime(new Date(`${row.day}T12:00:00`), { dateStyle: "long" })}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </li>
              );
            if (row.kind === "unread")
              return (
                <li key={row.key} className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-brick/40" />
                  <span className="text-[0.6875rem] font-semibold tracking-[0.085em] text-brick uppercase">
                    {t("newMessages")}
                  </span>
                  <span className="h-px flex-1 bg-brick/40" />
                </li>
              );
            return (
              <li key={row.key} className={cn(row.startsGroup ? "mt-3 first:mt-0" : "mt-0.5")}>
                <MessageItem
                  message={row.message}
                  mine={row.message.author_id === meId}
                  meId={meId}
                  startsGroup={row.startsGroup}
                  author={row.message.author_id ? memberMap.get(row.message.author_id) : undefined}
                  memberNames={memberNames}
                  memberMap={memberMap}
                  replyTarget={
                    row.message.reply_to
                      ? (messages.find((m) => m.id === row.message.reply_to) ?? null)
                      : null
                  }
                  canWrite={canWrite}
                  canModerate={canModerate}
                  photoUrls={photos.urls}
                  onPhotoExpired={photos.expired}
                  onReply={() => {
                    setReplyTo(row.message);
                    composerRef.current?.focus();
                  }}
                  onReport={() => setReason({ id: row.message.id, mode: "report" })}
                  onModerate={() => setReason({ id: row.message.id, mode: "moderate" })}
                  onDelete={() => setConfirmDelete(row.message.id)}
                />
                {(() => {
                  const poll = pollsByMessage.get(row.message.id);
                  if (!poll || row.message.deleted_at) return null;
                  return (
                    <div className="pl-11">
                      <PollCard
                        poll={poll}
                        threadId={threadId}
                        meId={meId}
                        names={memberLabels}
                        canClose={canModerate || poll.createdBy === meId}
                        showQuestion={false}
                      />
                    </div>
                  );
                })()}
              </li>
            );
          })}
        </ol>
      </div>

      {unseen > 0 && (
        <div className="pointer-events-none sticky bottom-2 z-10 flex justify-center">
          <Button
            type="button"
            size="sm"
            className="pointer-events-auto min-h-11 rounded-md shadow-lift"
            onClick={jumpToBottom}
          >
            <ChevronDownIcon aria-hidden />
            {t("newBelow", { count: unseen })}
          </Button>
        </div>
      )}

      {canWrite ? (
        <Composer
          ref={composerRef}
          threadId={threadId}
          schoolId={schoolId}
          hint={hint}
          replyTo={replyTo}
          replyName={
            replyTo?.author_id
              ? (memberMap.get(replyTo.author_id)?.name ?? t("message.unknown"))
              : t("message.unknown")
          }
          onCancelReply={() => setReplyTo(null)}
          onSent={(sent) => {
            setMessages((current) =>
              current.some((m) => m.id === sent.id)
                ? current
                : [
                    ...current,
                    {
                      ...sent,
                      edited_at: null,
                      deleted_at: null,
                      moderated_by: null,
                      moderation_reason: null,
                      reactions: [],
                    },
                  ],
            );
            setReplyTo(null);
            atBottomRef.current = true;
          }}
        />
      ) : (
        closedReason && (
          <div className="mt-4 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            <p>{closedReason}</p>
            {closedNote && <p className="mt-1 font-medium text-foreground">{closedNote}</p>}
          </div>
        )
      )}

      <ReasonDialog
        open={reason !== null}
        mode={reason?.mode ?? "report"}
        messageId={reason?.id ?? ""}
        excerpt={reasonTarget?.body.slice(0, 140) ?? ""}
        onClose={() => setReason(null)}
      />
      <DeleteDialog
        open={confirmDelete !== null}
        messageId={confirmDelete ?? ""}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function MessageItem({
  message,
  mine,
  meId,
  startsGroup,
  author,
  memberNames,
  memberMap,
  replyTarget,
  canWrite,
  canModerate,
  photoUrls,
  onPhotoExpired,
  onReply,
  onReport,
  onModerate,
  onDelete,
}: {
  message: Message;
  mine: boolean;
  meId: string;
  startsGroup: boolean;
  author: Member | undefined;
  memberNames: string[];
  memberMap: Map<string, Member>;
  replyTarget: Message | null;
  canWrite: boolean;
  canModerate: boolean;
  photoUrls: ReadonlyMap<string, string>;
  onPhotoExpired: (path: string) => void;
  onReply: () => void;
  onReport: () => void;
  onModerate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("messaging");
  const format = useFormatter();
  const attachments = parseAttachments(message.attachments);
  const name = mine ? t("message.you") : (author?.name ?? t("message.unknown"));

  // `mine` here means "I reacted", and it used to be assigned to itself while
  // being compared against the message's author: nobody could see their own
  // reaction, and a second tap silently removed it.
  const reactionCounts = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of message.reactions) {
    const entry = reactionCounts.get(reaction.emoji) ?? { count: 0, mine: false };
    entry.count++;
    if (reaction.user_id === meId) entry.mine = true;
    reactionCounts.set(reaction.emoji, entry);
  }

  const showMenu = canWrite || canModerate;

  return (
    <article id={`m-${message.id}`} className="group/message flex scroll-mt-24 gap-3">
      <div className="w-9 shrink-0">
        {startsGroup && !mine && (
          <UserAvatar name={author?.name} initials={author?.initials ?? "?"} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {startsGroup && (
          <p className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span className="text-[0.8125rem] font-semibold text-foreground">{name}</span>
            {author?.role === "moderator" && (
              <span className="rounded-sm bg-muted px-1 py-px text-[0.625rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {t("message.staff")}
              </span>
            )}
            <span>{format.dateTime(new Date(message.created_at), { timeStyle: "short" })}</span>
            {message.edited_at && <span>· {t("message.edited")}</span>}
          </p>
        )}
        <div className="flex items-start gap-1">
          <div
            className={cn(
              "max-w-[min(85%,42rem)] min-w-0 rounded-lg text-sm leading-[1.5]",
              // Photos need a width of their own: a bubble sized by its text was narrower than
              // the grid it carried, and the second photo overflowed it.
              !message.deleted_at && attachments.some(isPhoto) && "w-[min(17.5rem,85%)]",
              // A photo sent alone sits in a thin frame of the bubble, not in a padded card.
              !message.deleted_at && attachments.length > 0 && !message.body && !replyTarget
                ? "p-1"
                : "px-3 py-2",
              mine
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm border border-border bg-card text-card-foreground",
            )}
          >
            {replyTarget && (
              <p
                className={cn(
                  "mb-1 flex items-center gap-1 border-l-2 pl-2 text-xs opacity-80",
                  mine ? "border-primary-foreground/50" : "border-primary/50",
                )}
              >
                <CornerDownRightIcon className="size-3 shrink-0" aria-hidden />
                {(replyTarget.author_id && memberMap.get(replyTarget.author_id)?.name) ??
                  t("message.unknown")}{" "}
                : {replyTarget.deleted_at ? t("message.deleted") : replyTarget.body.slice(0, 80)}
              </p>
            )}
            {message.deleted_at ? (
              <p className="italic opacity-70">
                {message.moderation_reason
                  ? t("message.moderated", { reason: message.moderation_reason })
                  : t("message.deleted")}
              </p>
            ) : message.body ? (
              <p dir="auto" className="break-words whitespace-pre-wrap">
                {segmentMentions(message.body, memberNames).map((segment, i) =>
                  segment.mention ? (
                    <span key={i} className="font-semibold underline decoration-dotted">
                      {segment.text}
                    </span>
                  ) : (
                    <span key={i}>{segment.text}</span>
                  ),
                )}
              </p>
            ) : null}
            {!message.deleted_at && attachments.length > 0 && (
              <div className={cn(message.body && "mt-2")}>
                <MessageAttachments
                  attachments={attachments}
                  urls={photoUrls}
                  onExpired={onPhotoExpired}
                  title={name}
                  mine={mine}
                />
              </div>
            )}
          </div>

          {/*
            One control instead of five. Every message used to carry Reply,
            React, Report, Delete and Moderate as permanent 28 px buttons —
            sixty to a hundred of them in a twenty-message thread, all of them
            below the 44 px the project mandates.
          */}
          {showMenu && !message.deleted_at && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("message.actions")}
                  className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 md:size-8 md:opacity-0 md:group-focus-within/message:opacity-100 md:group-hover/message:opacity-100"
                >
                  <MoreHorizontalIcon className="size-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={mine ? "end" : "start"}>
                {canWrite && (
                  <>
                    <div className="flex gap-0.5 px-1 py-1">
                      {REACTION_EMOJIS.map((emoji) => (
                        <form key={emoji} action={toggleReaction}>
                          <input type="hidden" name="messageId" value={message.id} />
                          <input type="hidden" name="emoji" value={emoji} />
                          <button
                            type="submit"
                            aria-label={emoji}
                            className="flex size-9 items-center justify-center rounded-md text-base hover:bg-muted"
                          >
                            {emoji}
                          </button>
                        </form>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onReply}>
                      <ReplyIcon aria-hidden />
                      {t("message.reply")}
                    </DropdownMenuItem>
                  </>
                )}
                {!mine && canWrite && (
                  <DropdownMenuItem onSelect={onReport}>
                    <FlagIcon aria-hidden />
                    {t("message.report")}
                  </DropdownMenuItem>
                )}
                {mine && (
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2Icon aria-hidden />
                    {t("message.delete")}
                  </DropdownMenuItem>
                )}
                {canModerate && !mine && (
                  <DropdownMenuItem variant="destructive" onSelect={onModerate}>
                    <ShieldXIcon aria-hidden />
                    {t("message.moderate")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {reactionCounts.size > 0 && !message.deleted_at && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {[...reactionCounts.entries()].map(([emoji, entry]) => (
              <form key={emoji} action={toggleReaction}>
                <input type="hidden" name="messageId" value={message.id} />
                <input type="hidden" name="emoji" value={emoji} />
                <button
                  type="submit"
                  aria-pressed={entry.mine}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-sm border px-1.5 text-[0.6875rem] font-semibold",
                    entry.mine
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                  disabled={!canWrite}
                >
                  {emoji} {entry.count}
                </button>
              </form>
            ))}
            {canWrite && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("message.react")}
                    className="flex size-6 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground hover:bg-muted"
                  >
                    <SmilePlusIcon className="size-3.5" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="flex gap-0.5 p-1">
                  {REACTION_EMOJIS.map((emoji) => (
                    <form key={emoji} action={toggleReaction}>
                      <input type="hidden" name="messageId" value={message.id} />
                      <input type="hidden" name="emoji" value={emoji} />
                      <button
                        type="submit"
                        aria-label={emoji}
                        className="flex size-9 items-center justify-center rounded-md text-base hover:bg-muted"
                      >
                        {emoji}
                      </button>
                    </form>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Reporting and moderating open a dialog instead of pushing a form into the thread. */
function ReasonDialog({
  open,
  mode,
  messageId,
  excerpt,
  onClose,
}: {
  open: boolean;
  mode: "report" | "moderate";
  messageId: string;
  excerpt: string;
  onClose: () => void;
}) {
  const t = useTranslations("messaging");
  const [state, action, pending] = useActionState(
    mode === "report" ? reportMessage : moderateMessage,
    { status: "idle" as const },
  );
  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form action={action} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {mode === "report" ? t("report.reason") : t("message.reason")}
            </DialogTitle>
            {excerpt && <DialogDescription>« {excerpt} »</DialogDescription>}
          </DialogHeader>
          <input type="hidden" name="messageId" value={messageId} />
          <Textarea name="reason" rows={3} maxLength={500} required autoFocus />
          {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              <XIcon aria-hidden />
              {t("composer.cancel")}
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              variant={mode === "moderate" ? "destructive" : "default"}
              disabled={pending}
            >
              {mode === "report" ? t("report.submit") : t("message.moderate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Deleting used to be destructive on the first click, with no confirmation. */
function DeleteDialog({
  open,
  messageId,
  onClose,
}: {
  open: boolean;
  messageId: string;
  onClose: () => void;
}) {
  const t = useTranslations("messaging");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("message.delete")}</DialogTitle>
          <DialogDescription>{t("message.deleteConfirm")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            {t("composer.cancel")}
          </Button>
          <form action={deleteOwnMessage} onSubmit={onClose}>
            <input type="hidden" name="messageId" value={messageId} />
            <Button type="submit" variant="destructive" className="min-h-11">
              <Trash2Icon aria-hidden />
              {t("message.delete")}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Composer({
  ref,
  threadId,
  schoolId,
  hint,
  replyTo,
  replyName,
  onCancelReply,
  onSent,
}: {
  ref?: Ref<{ focus: () => void }>;
  threadId: string;
  schoolId: string;
  hint?: string;
  replyTo: Message | null;
  replyName: string;
  onCancelReply: () => void;
  onSent: (sent: NonNullable<SendState["sent"]>) => void;
}) {
  const t = useTranslations("messaging");
  const tAttachments = useTranslations("attachments");
  const [state, action, pending] = useActionState(sendMessage, initialSend);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const lastSent = useRef<string | null>(null);
  // A photo leaves the phone the moment it is chosen, re-encoded without its metadata: by the
  // time the message is typed, it is there (ADR-0071).
  const uploads = useUploads({
    bucket: "messages",
    folder: messageFolder(schoolId, threadId),
    maxFiles: UPLOAD_LIMITS.messages.maxFiles,
    maxPdfBytes: UPLOAD_LIMITS.messages.maxPdfBytes,
    allowPdf: true,
    image: { maxEdge: IMAGE_EDGES.message, quality: 0.84, thumbEdge: IMAGE_EDGES.thumb },
    normalisedByServer: false,
  });

  useEffect(() => {
    if (ref && typeof ref === "object") ref.current = { focus: () => textRef.current?.focus() };
  }, [ref]);

  useEffect(() => {
    if (state.status === "success" && state.sent && state.sent.id !== lastSent.current) {
      lastSent.current = state.sent.id;
      onSent(state.sent);
      formRef.current?.reset();
      uploads.reset();
      // Resetting the form used to close the keyboard between two messages.
      textRef.current?.focus();
    }
  }, [state, onSent, uploads]);

  const blocked = pending || uploads.busy || uploads.failed;

  return (
    <form
      ref={formRef}
      action={action}
      // `bottom-16` was 64 px against a tab bar of 56 px plus 34 px of iPhone
      // safe area: 26 px of the composer, the Send button included, sat under it.
      className="sticky bottom-[calc(var(--nav-h)+0.5rem)] mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-lift lg:bottom-2"
      onPaste={(event) => {
        // A screenshot pasted into the message joins it, as it would in any other messenger.
        const pasted = Array.from(event.clipboardData.files);
        if (pasted.length > 0) {
          event.preventDefault();
          uploads.add(pasted);
        }
      }}
    >
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="attachments" value={JSON.stringify(uploads.messageUploads)} />
      {replyTo && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
          <input type="hidden" name="replyTo" value={replyTo.id} />
          <span className="truncate">
            {t("composer.replyingTo", { name: replyName })} : {replyTo.body.slice(0, 60)}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label={t("composer.cancel")}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}
      {uploads.items.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto pb-0.5" aria-label={t("composer.attached")}>
          {uploads.items.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted",
                item.status === "error" ? "border-destructive" : "border-border",
              )}
              aria-busy={item.status === "preparing" || item.status === "uploading"}
            >
              {item.kind === "image" && item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview
                <img src={item.previewUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-0.5 p-1 text-center">
                  <FileTextIcon aria-hidden className="size-4 text-muted-foreground" />
                  <span className="line-clamp-2 text-[0.625rem] leading-tight break-all">
                    {item.name}
                  </span>
                </span>
              )}
              {(item.status === "preparing" || item.status === "uploading") && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/45">
                  <Loader2Icon aria-hidden className="size-4 animate-spin text-primary" />
                </span>
              )}
              {item.status === "error" && (
                <button
                  type="button"
                  onClick={() => uploads.retry(item.id)}
                  className="absolute inset-x-0 bottom-0 bg-background/95 py-0.5 text-[0.625rem] font-semibold text-destructive"
                >
                  {tAttachments("retry")}
                </button>
              )}
              <span className="sr-only" role="status">
                {item.status === "done"
                  ? tAttachments("ready", { name: tAttachments("photoN", { n: index + 1 }) })
                  : item.status === "error"
                    ? tAttachments(`error.${item.error ?? "failed"}`)
                    : tAttachments("preparing")}
              </span>
              <button
                type="button"
                onClick={() => uploads.remove(item.id)}
                aria-label={tAttachments("remove", {
                  name:
                    item.kind === "image" ? tAttachments("photoN", { n: index + 1 }) : item.name,
                })}
                className="absolute top-0 right-0 flex size-8 items-start justify-end p-0.5"
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-background/90 ring-1 ring-border">
                  <XIcon aria-hidden className="size-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Textarea
        ref={textRef}
        name="body"
        rows={2}
        maxLength={5000}
        dir="auto"
        placeholder={hint ?? t("composer.placeholder")}
        className="field-sizing-content max-h-40 resize-none"
        onKeyDown={(e) => {
          // Enter sends on a keyboard; on a touch screen it has to make a line
          // break, or writing a paragraph with a thumb is impossible.
          const touch =
            typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
          if (e.key === "Enter" && !e.shiftKey && !touch) {
            e.preventDefault();
            if (!blocked) formRef.current?.requestSubmit();
          }
        }}
      />
      {uploads.refusal && (
        <p role="alert" className="text-xs text-destructive">
          {tAttachments(`refusal.${uploads.refusal}`)}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* Two doors: the camera, on a phone — the page of tonight's homework is one tap
              away — and the gallery or a file. */}
          <button
            type="button"
            onClick={() => camera.current?.click()}
            aria-label={tAttachments("takePhoto")}
            className="hidden size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground any-pointer-coarse:flex"
          >
            <CameraIcon aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="flex min-h-11 items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PaperclipIcon className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("composer.attach")}</span>
          </button>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              uploads.add(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={picker}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              uploads.add(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          <PollComposer threadId={threadId} />
        </div>
        <div className="flex items-center gap-2">
          {state.status === "error" && (
            <span role="alert" className="text-xs text-destructive">
              {state.message}
            </span>
          )}
          <Button type="submit" className="min-h-11" disabled={blocked}>
            {pending || uploads.busy ? (
              <Loader2Icon aria-hidden className="animate-spin" />
            ) : (
              <SendIcon aria-hidden />
            )}
            {t("composer.send")}
          </Button>
        </div>
      </div>
    </form>
  );
}
