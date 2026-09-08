"use client";

import { useEffect } from "react";

import { markAnnouncementRead } from "@/server/actions/announcements";

/** Records the read receipt once the announcement is on screen. */
export function MarkRead({ id, alreadyRead }: { id: string; alreadyRead: boolean }) {
  useEffect(() => {
    if (!alreadyRead) void markAnnouncementRead(id);
  }, [id, alreadyRead]);
  return null;
}
