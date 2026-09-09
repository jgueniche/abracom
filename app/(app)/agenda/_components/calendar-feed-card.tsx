"use client";

import { CalendarPlusIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCalendarFeed, rotateCalendarFeed, setFeedHolidays } from "@/server/actions/agenda";

export function CalendarFeedCard({
  feed,
  origin,
}: {
  feed: { token: string; include_holidays: boolean; rotated_at: string } | null;
  origin: string;
}) {
  const t = useTranslations("agenda.feed");
  const format = useFormatter();
  const [copied, setCopied] = useState(false);
  const url = feed ? `${origin}/api/calendar/${feed.token}` : null;
  const webcal = url ? url.replace(/^https?:/, "webcal:") : null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable: the address stays selectable in the input
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!url || !feed ? (
          <form action={createCalendarFeed}>
            <Button type="submit" className="min-h-11">
              <CalendarPlusIcon aria-hidden />
              {t("create")}
            </Button>
          </form>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("url")}</span>
              <span className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-h-11 w-full rounded-lg border border-input bg-muted/40 px-3 font-mono text-xs"
                />
                <Button type="button" variant="outline" className="min-h-11" onClick={copy}>
                  <CopyIcon aria-hidden />
                  {copied ? t("copied") : t("copy")}
                </Button>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="min-h-11">
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal!)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("google")}
                </a>
              </Button>
              <Button asChild variant="secondary" className="min-h-11">
                <a href={webcal!}>{t("apple")}</a>
              </Button>
            </div>
            <form action={setFeedHolidays} className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="includeHolidays"
                  defaultChecked={feed.include_holidays}
                  className="size-5 accent-primary"
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                />
                {t("includeHolidays")}
              </label>
            </form>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                {t("rotatedOn", {
                  date: format.dateTime(new Date(feed.rotated_at), { dateStyle: "medium" }),
                })}
              </span>
              <form action={rotateCalendarFeed} className="flex items-center gap-2">
                <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                  <RefreshCwIcon aria-hidden />
                  {t("rotate")}
                </Button>
                <span>{t("rotateHint")}</span>
              </form>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
