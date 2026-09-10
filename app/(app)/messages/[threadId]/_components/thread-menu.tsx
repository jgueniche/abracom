"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BellIcon,
  BellOffIcon,
  LockIcon,
  LockOpenIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  MoreVerticalIcon,
  RadioIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setThreadReplies, setThreadState, toggleMute } from "@/server/actions/messaging";

/**
 * Mute, lock and archive were three stacked full-width buttons inside the page
 * header — about 140 px of chrome before the conversation even started. They
 * are settings, not content: they belong in a menu.
 */
export function ThreadMenu({
  threadId,
  isMember,
  muted,
  locked,
  archived,
  canModerate,
  searchHref,
  allowReplies,
  canSetReplies = false,
  schoolClosed = false,
  override = false,
}: {
  threadId: string;
  isMember: boolean;
  muted: boolean;
  locked: boolean;
  archived: boolean;
  canModerate: boolean;
  searchHref: string;
  allowReplies?: boolean;
  /** A class thread the reader runs: the teacher's own switch on their channel. */
  canSetReplies?: boolean;
  schoolClosed?: boolean;
  override?: boolean;
}) {
  const t = useTranslations("messaging");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("conversation")}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <MoreVerticalIcon className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={searchHref}>
            <SearchIcon aria-hidden />
            {t("search")}
          </Link>
        </DropdownMenuItem>
        {isMember && (
          <>
            <DropdownMenuSeparator />
            <form action={toggleMute}>
              <input type="hidden" name="threadId" value={threadId} />
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  {muted ? <BellIcon aria-hidden /> : <BellOffIcon aria-hidden />}
                  {muted ? t("unmute") : t("mute")}
                </button>
              </DropdownMenuItem>
            </form>
          </>
        )}
        {canSetReplies && (
          <>
            <DropdownMenuSeparator />
            {/* `allow_replies` existed in the very first migration and was exposed
                nowhere. It is the teacher's own switch, in words they use. */}
            <form action={setThreadReplies}>
              <input type="hidden" name="threadId" value={threadId} />
              <input type="hidden" name="allowReplies" value={String(!allowReplies)} />
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  {allowReplies ? (
                    <MegaphoneIcon aria-hidden />
                  ) : (
                    <MessagesSquareIcon aria-hidden />
                  )}
                  {allowReplies ? t("makeAnnouncement") : t("allowReplies")}
                </button>
              </DropdownMenuItem>
            </form>
            {schoolClosed && (
              <form action={setThreadReplies}>
                <input type="hidden" name="threadId" value={threadId} />
                <input type="hidden" name="override" value={String(!override)} />
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full">
                    <RadioIcon aria-hidden />
                    {override ? t("dropOverride") : t("takeOverride")}
                  </button>
                </DropdownMenuItem>
              </form>
            )}
          </>
        )}
        {canModerate && (
          <>
            <DropdownMenuSeparator />
            <form action={setThreadState}>
              <input type="hidden" name="threadId" value={threadId} />
              <input type="hidden" name="locked" value={String(!locked)} />
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  {locked ? <LockOpenIcon aria-hidden /> : <LockIcon aria-hidden />}
                  {locked ? t("unlock") : t("lock")}
                </button>
              </DropdownMenuItem>
            </form>
            <form action={setThreadState}>
              <input type="hidden" name="threadId" value={threadId} />
              <input type="hidden" name="archived" value={String(!archived)} />
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  {archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
                  {archived ? t("unarchive") : t("archive")}
                </button>
              </DropdownMenuItem>
            </form>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
