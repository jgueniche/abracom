"use client";

import {
  CornerDownRightIcon,
  FlagIcon,
  PaperclipIcon,
  ReplyIcon,
  SendIcon,
  ShieldXIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  dayKey,
  type MessageAttachment,
  parseAttachments,
  REACTION_EMOJIS,
  segmentMentions,
} from "@/lib/messaging/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  deleteOwnMessage,
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

export function ThreadView({
  threadId,
  initialMessages,
  members,
  meId,
  canWrite,
  canModerate,
  closedReason,
  searchMode,
}: {
  threadId: string;
  initialMessages: Message[];
  members: Member[];
  meId: string;
  canWrite: boolean;
  canModerate: boolean;
  closedReason: string | null;
  searchMode: boolean;
}) {
  const t = useTranslations("messaging");
  const format = useFormatter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [moderateFor, setModerateFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const memberNames = useMemo(() => members.map((m) => m.name), [members]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

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
          void markThreadRead(threadId);
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
      .subscribe();
    void markThreadRead(threadId);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, searchMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const days = useMemo(() => {
    const groups: Array<{ day: string; items: Message[] }> = [];
    for (const message of messages) {
      const day = dayKey(message.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(message);
      else groups.push({ day, items: [message] });
    }
    return groups;
  }, [messages]);

  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {days.map((group) => (
          <li key={group.day} className="flex flex-col gap-3">
            <p className="mx-auto rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
              {group.day === today
                ? t("today")
                : group.day === yesterday
                  ? t("yesterday")
                  : format.dateTime(new Date(`${group.day}T12:00:00`), { dateStyle: "long" })}
            </p>
            {group.items.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                mine={message.author_id === meId}
                author={message.author_id ? memberMap.get(message.author_id) : undefined}
                memberNames={memberNames}
                memberMap={memberMap}
                replyTarget={
                  message.reply_to
                    ? (messages.find((m) => m.id === message.reply_to) ?? null)
                    : null
                }
                canWrite={canWrite}
                canModerate={canModerate}
                onReply={() => setReplyTo(message)}
                onReport={() => setReportFor(message.id)}
                onModerate={() => setModerateFor(message.id)}
                reporting={reportFor === message.id}
                moderating={moderateFor === message.id}
                onCloseForms={() => {
                  setReportFor(null);
                  setModerateFor(null);
                }}
              />
            ))}
          </li>
        ))}
      </ol>
      <div ref={bottomRef} />
      {canWrite ? (
        <Composer
          threadId={threadId}
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
          }}
        />
      ) : (
        closedReason && (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{closedReason}</p>
        )
      )}
    </div>
  );
}

function MessageItem({
  message,
  mine,
  author,
  memberNames,
  memberMap,
  replyTarget,
  canWrite,
  canModerate,
  onReply,
  onReport,
  onModerate,
  reporting,
  moderating,
  onCloseForms,
}: {
  message: Message;
  mine: boolean;
  author: Member | undefined;
  memberNames: string[];
  memberMap: Map<string, Member>;
  replyTarget: Message | null;
  canWrite: boolean;
  canModerate: boolean;
  onReply: () => void;
  onReport: () => void;
  onModerate: () => void;
  reporting: boolean;
  moderating: boolean;
  onCloseForms: () => void;
}) {
  const t = useTranslations("messaging");
  const format = useFormatter();
  const attachments = parseAttachments(message.attachments);
  const name = mine ? t("message.you") : (author?.name ?? t("message.unknown"));
  const reactionCounts = new Map<string, { count: number; mine: boolean }>();
  for (const r of message.reactions) {
    const entry = reactionCounts.get(r.emoji) ?? { count: 0, mine: false };
    entry.count++;
    if (r.user_id === author?.id && mine) entry.mine = entry.mine;
    reactionCounts.set(r.emoji, entry);
  }

  return (
    <article className={cn("flex gap-3", mine && "flex-row-reverse")}>
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="bg-accent text-xs text-accent-foreground">
          {author?.initials ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex max-w-[85%] flex-col gap-1", mine && "items-end")}>
        <p className="text-xs text-muted-foreground">
          {name} · {format.dateTime(new Date(message.created_at), { timeStyle: "short" })}
          {message.edited_at && ` · ${t("message.edited")}`}
        </p>
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm",
            mine ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          {replyTarget && (
            <p
              className={cn(
                "mb-1 flex items-center gap-1 border-l-2 pl-2 text-xs opacity-80",
                mine ? "border-primary-foreground/50" : "border-primary/50",
              )}
            >
              <CornerDownRightIcon className="size-3" aria-hidden />
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
          ) : (
            <p className="break-words whitespace-pre-wrap">
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
          )}
          {!message.deleted_at && attachments.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {attachments.map((file: MessageAttachment) => (
                <li key={file.path}>
                  <a
                    href={`/api/storage/messages?path=${encodeURIComponent(file.path)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 underline"
                  >
                    <PaperclipIcon className="size-3" aria-hidden />
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(reactionCounts.size > 0 || canWrite) && !message.deleted_at && (
          <div className="flex flex-wrap items-center gap-1">
            {[...reactionCounts.entries()].map(([emoji, entry]) => (
              <form key={emoji} action={toggleReaction}>
                <input type="hidden" name="messageId" value={message.id} />
                <input type="hidden" name="emoji" value={emoji} />
                <button
                  type="submit"
                  className="rounded-full border bg-background px-2 py-0.5 text-xs"
                  disabled={!canWrite}
                >
                  {emoji} {entry.count}
                </button>
              </form>
            ))}
            {canWrite && (
              <details className="relative">
                <summary
                  className="cursor-pointer list-none px-1 text-xs text-muted-foreground"
                  aria-label={t("message.react")}
                >
                  ＋
                </summary>
                <div className="absolute z-10 mt-1 flex gap-1 rounded-full border bg-popover p-1 shadow">
                  {REACTION_EMOJIS.map((emoji) => (
                    <form key={emoji} action={toggleReaction}>
                      <input type="hidden" name="messageId" value={message.id} />
                      <input type="hidden" name="emoji" value={emoji} />
                      <button
                        type="submit"
                        className="rounded-full px-1.5 py-0.5 text-base hover:bg-accent"
                      >
                        {emoji}
                      </button>
                    </form>
                  ))}
                </div>
              </details>
            )}
            {canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onReply}
              >
                <ReplyIcon className="size-3" aria-hidden />
                {t("message.reply")}
              </Button>
            )}
            {!mine && canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onReport}
              >
                <FlagIcon className="size-3" aria-hidden />
                {t("message.report")}
              </Button>
            )}
            {mine && (
              <form action={deleteOwnMessage}>
                <input type="hidden" name="messageId" value={message.id} />
                <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Trash2Icon className="size-3" aria-hidden />
                  {t("message.delete")}
                </Button>
              </form>
            )}
            {canModerate && !mine && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive"
                onClick={onModerate}
              >
                <ShieldXIcon className="size-3" aria-hidden />
                {t("message.moderate")}
              </Button>
            )}
          </div>
        )}
        {reporting && <ReasonForm messageId={message.id} mode="report" onClose={onCloseForms} />}
        {moderating && <ReasonForm messageId={message.id} mode="moderate" onClose={onCloseForms} />}
      </div>
    </article>
  );
}

function ReasonForm({
  messageId,
  mode,
  onClose,
}: {
  messageId: string;
  mode: "report" | "moderate";
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
    <form
      action={action}
      className="flex w-full flex-col gap-2 rounded-xl border bg-background p-3"
    >
      <input type="hidden" name="messageId" value={messageId} />
      <label className="text-sm font-medium" htmlFor={`reason-${messageId}`}>
        {mode === "report" ? t("report.reason") : t("message.reason")}
      </label>
      <Textarea id={`reason-${messageId}`} name="reason" rows={2} maxLength={500} required />
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          variant={mode === "moderate" ? "destructive" : "default"}
          disabled={pending}
        >
          {mode === "report" ? t("report.submit") : t("message.moderate")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <XIcon aria-hidden />
          {t("composer.cancel")}
        </Button>
      </div>
    </form>
  );
}

function Composer({
  threadId,
  replyTo,
  replyName,
  onCancelReply,
  onSent,
}: {
  threadId: string;
  replyTo: Message | null;
  replyName: string;
  onCancelReply: () => void;
  onSent: (sent: NonNullable<SendState["sent"]>) => void;
}) {
  const t = useTranslations("messaging");
  const [state, action, pending] = useActionState(sendMessage, initialSend);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "success" && state.sent && state.sent.id !== lastSent.current) {
      lastSent.current = state.sent.id;
      onSent(state.sent);
      formRef.current?.reset();
    }
  }, [state, onSent]);

  return (
    <form
      ref={formRef}
      action={action}
      className="sticky bottom-16 flex flex-col gap-2 rounded-2xl border bg-background p-3 shadow-sm md:bottom-4"
    >
      <input type="hidden" name="threadId" value={threadId} />
      {replyTo && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <input type="hidden" name="replyTo" value={replyTo.id} />
          <span className="truncate">
            {t("composer.replyingTo", { name: replyName })} : {replyTo.body.slice(0, 60)}
          </span>
          <button type="button" onClick={onCancelReply} aria-label={t("composer.cancel")}>
            <XIcon className="size-4" />
          </button>
        </div>
      )}
      <Textarea
        name="body"
        rows={2}
        maxLength={5000}
        placeholder={t("composer.placeholder")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <PaperclipIcon className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("composer.attach")}</span>
          <input
            type="file"
            name="files"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
          />
        </label>
        <div className="flex items-center gap-2">
          {state.status === "error" && (
            <span className="text-xs text-destructive">{state.message}</span>
          )}
          <Button type="submit" size="sm" className="min-h-10" disabled={pending}>
            <SendIcon aria-hidden />
            {t("composer.send")}
          </Button>
        </div>
      </div>
    </form>
  );
}
