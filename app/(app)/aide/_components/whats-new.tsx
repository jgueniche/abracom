"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

/**
 * "What changed since your last visit", remembered in the browser.
 *
 * Deliberately not a table: a read marker is a per-device convenience, not a
 * fact the school needs about a family. Storing it would mean a row, a policy
 * and a pgTAP assertion for something whose worst failure is a badge showing up
 * twice (ADR-0047). `localStorage` can throw — private window, blocked storage
 * — so every access is guarded and the page renders correctly without it.
 */
const KEY = "kesher-help-seen";

function readSeen(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeSeen(value: number): void {
  try {
    window.localStorage.setItem(KEY, String(value));
  } catch {
    // A viewer who blocks storage simply keeps being told what is new.
  }
}

/**
 * The highest `since` this reader has already acknowledged — `null` until the
 * component is mounted, because the server cannot know it and guessing would
 * flash a wrong count. `markSeen` is what turns the page into an acknowledgement.
 */
function useSeen(sinceList: readonly number[], markSeen: boolean): number | null {
  // A joined string keeps the effect stable: the array is rebuilt every render.
  const key = sinceList.join(",");
  const [seen, setSeen] = useState<number | null>(null);

  useEffect(() => {
    const values = key === "" ? [] : key.split(",").map(Number);
    const highest = values.reduce((max, value) => Math.max(max, value), 0);
    const stored = readSeen();
    // First visit: start the counter where the reader is, instead of announcing
    // forty-three "new" articles to someone who has never opened the help.
    if (stored === null) {
      writeSeen(highest);
      setSeen(highest);
      return;
    }
    setSeen(stored);
    if (markSeen && highest > stored) writeSeen(highest);
  }, [key, markSeen]);

  return seen;
}

function countNew(sinceList: readonly number[], seen: number | null): number {
  return seen === null ? 0 : sinceList.filter((value) => value > seen).length;
}

export function WhatsNewBadge({ sinceList }: { sinceList: number[] }) {
  const t = useTranslations("help.whatsNew");
  const count = countNew(sinceList, useSeen(sinceList, false));
  if (count === 0) return null;
  return (
    <span className="ml-1 min-w-5 rounded-full bg-brick px-1.5 text-center text-xs leading-5 font-semibold text-brick-foreground">
      {count}
      <span className="sr-only"> {t("badge", { count })}</span>
    </span>
  );
}

export type WhatsNewItem = {
  slug: string;
  title: string;
  topic: string;
  excerpt: string;
  since: number;
};

export function WhatsNewList({ items }: { items: WhatsNewItem[] }) {
  const t = useTranslations("help.whatsNew");
  const tTopics = useTranslations("help.topics");
  const sinceList = items.map((item) => item.since);
  const seen = useSeen(sinceList, true);
  const count = countNew(sinceList, seen);

  return (
    <>
      {/* The list order never changes; only the pills and this line appear. */}
      <p className="mb-4 text-sm text-muted-foreground" role="status">
        {count > 0 ? `${t("sinceLastVisit")} · ${t("badge", { count })}` : t("seen")}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/aide/${item.slug}`}
              className="flex min-h-11 flex-col rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.title}</span>
                {seen !== null && item.since > seen && <Badge>{t("new")}</Badge>}
                <span className="text-xs text-muted-foreground">{tTopics(item.topic)}</span>
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
