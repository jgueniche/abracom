import { MessageSquareOffIcon, RadioIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { utcToZonedNaive } from "@/lib/calendar/dates";
import { deleteMessagingWindow } from "@/server/actions/admin/messaging";
import { setThreadReplies } from "@/server/actions/messaging";
import { getAdminClasses, getTeachers } from "@/server/queries/admin";
import {
  getMessagingChannels,
  getMessagingLoad,
  getMessagingWindows,
} from "@/server/queries/messaging";

import { MessagingModeForm } from "./mode-form";
import { MessagingWindowForm } from "./window-form";

type MessagingModules = {
  parentToStaff?: "open" | "closed" | "scheduled";
  closedScopes?: string[];
  urgencyContact?: string | null;
};

/** `modules.messaging` is a bare `true` until the direction touches the switch. */
function readMessagingModules(modules: unknown): MessagingModules {
  if (!modules || typeof modules !== "object") return {};
  const messaging = (modules as { messaging?: unknown }).messaging;
  return messaging && typeof messaging === "object" ? (messaging as MessagingModules) : {};
}

/**
 * The direction's pilot screen (session 19, chantier A): what is open, one
 * switch per line, and the load that justifies closing. Without the numbers the
 * directrice closes blind.
 */
export default async function MessagingControlPage() {
  const { user, schoolId } = await requireSchoolAdmin();
  const [t, format, windows, channels, load, classes, teachers] = await Promise.all([
    getTranslations("admin.messaging"),
    getFormatter(),
    getMessagingWindows(schoolId),
    getMessagingChannels(schoolId),
    getMessagingLoad(schoolId, 8),
    getAdminClasses(schoolId),
    getTeachers(schoolId),
  ]);

  const timeZone = user.school?.timezone ?? "Europe/Paris";
  const settings = readMessagingModules(user.school?.modules);
  const mode = settings.parentToStaff ?? "open";
  const scopes = Array.isArray(settings.closedScopes) ? settings.closedScopes : ["teachers"];
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  const later = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const teacherNames = new Map(
    teachers.map((m) => [m.user_id, `${m.profile!.first_name} ${m.profile!.last_name}`]),
  );
  const classNames = new Map(classes.map((c) => [c.id, c.name]));

  // The load, folded into one line per channel with a week-by-week series.
  // The eight slots are computed from today, not from the data: with a single
  // busy week the bar would otherwise fill the row and mean nothing.
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const week = new Date(monday);
    week.setUTCDate(week.getUTCDate() - (7 - index) * 7 + 7);
    return week.toISOString().slice(0, 10);
  });
  const byChannel = new Map<
    string,
    { label: string; total: number; perWeek: Map<string, number> }
  >();
  for (const row of load) {
    const key = row.class_id ?? row.teacher_id ?? "office";
    const label = row.class_id
      ? (classNames.get(row.class_id) ?? t("channels.unknownClass"))
      : row.teacher_id
        ? (teacherNames.get(row.teacher_id) ?? t("channels.unknownTeacher"))
        : t("channels.office");
    const entry = byChannel.get(key) ?? { label, total: 0, perWeek: new Map() };
    entry.total += Number(row.messages);
    entry.perWeek.set(row.week_start, Number(row.messages));
    byChannel.set(key, entry);
  }
  const channelLoad = [...byChannel.values()].sort((a, b) => b.total - a.total);
  const peak = Math.max(1, ...channelLoad.flatMap((c) => [...c.perWeek.values()]));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <Badge variant={mode === "open" ? "secondary" : "destructive"} className="self-center">
            {t(`modes.${mode}`)}
          </Badge>
        }
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("modeTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MessagingModeForm
              mode={mode}
              scopes={scopes}
              urgencyContact={settings.urgencyContact ?? ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("windowsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">{t("windowsHint")}</p>
            {windows.length === 0 ? (
              <EmptyState icon={RadioIcon} title={t("noWindow")} description={t("noWindowHint")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {windows.map((w) => {
                  const running = new Date(w.opens_at) <= now && new Date(w.closes_at) > now;
                  return (
                    <li
                      key={w.id}
                      className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
                    >
                      <Badge variant={w.kind === "open" ? "secondary" : "destructive"}>
                        {t(`windowKinds.${w.kind}`)}
                      </Badge>
                      <span className="text-sm">
                        {format.dateTime(new Date(w.opens_at), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {" → "}
                        {format.dateTime(new Date(w.closes_at), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`scopes.${w.scope}`)}
                        {w.class ? ` · ${w.class.name}` : ""}
                        {w.target ? ` · ${w.target.first_name} ${w.target.last_name}` : ""}
                        {w.note ? ` · ${w.note}` : ""}
                      </span>
                      {running && <Badge variant="outline">{t("running")}</Badge>}
                      <form action={deleteMessagingWindow} className="sm:ms-auto">
                        <input type="hidden" name="windowId" value={w.id} />
                        <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                          {t("removeWindow")}
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <MessagingWindowForm
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              teachers={teachers.map((m) => ({
                id: m.user_id,
                name: `${m.profile!.first_name} ${m.profile!.last_name}`,
              }))}
              defaultStart={utcToZonedNaive(nextHour, timeZone)}
              defaultEnd={utcToZonedNaive(later, timeZone)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("channelsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("channelsHint")}</p>
            {channels.length === 0 ? (
              <EmptyState
                icon={MessageSquareOffIcon}
                title={t("noChannel")}
                description={t("noChannelHint")}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {channels.map((channel) => (
                  <li
                    key={channel.thread_id}
                    // On a 390 px screen the class name was squeezed to "CE1…"
                    // by two buttons sharing its line: they get their own row.
                    className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {channel.class_name} · {t(`channelKinds.${channel.kind}`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!channel.allow_replies
                          ? t("channelAnnouncementOnly")
                          : channel.is_open
                            ? t("channelOpen")
                            : t("channelClosed")}
                        {!channel.is_open && channel.reopens_at
                          ? ` · ${t("reopensOn", {
                              date: format.dateTime(new Date(channel.reopens_at), {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }),
                            })}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {channel.override && (
                        <form action={setThreadReplies}>
                          <input type="hidden" name="threadId" value={channel.thread_id} />
                          <input type="hidden" name="override" value="false" />
                          <Button type="submit" variant="outline" size="sm" className="min-h-11">
                            {t("removeOverride")}
                          </Button>
                        </form>
                      )}
                      <form action={setThreadReplies}>
                        <input type="hidden" name="threadId" value={channel.thread_id} />
                        <input
                          type="hidden"
                          name="allowReplies"
                          value={String(!channel.allow_replies)}
                        />
                        <Button type="submit" variant="outline" size="sm" className="min-h-11">
                          {channel.allow_replies ? t("makeAnnouncement") : t("allowReplies")}
                        </Button>
                      </form>
                      <Button asChild variant="ghost" size="sm" className="min-h-11">
                        <Link href={`/messages/${channel.thread_id}`}>{t("openChannel")}</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("loadTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("loadHint")}</p>
            {channelLoad.length === 0 ? (
              <EmptyState title={t("noLoad")} description={t("noLoadHint")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {channelLoad.map((channel) => (
                  <li key={channel.label} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{channel.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t("messagesTotal", { count: channel.total })}
                      </span>
                    </div>
                    <div className="flex h-11 items-end gap-1" aria-hidden>
                      {weeks.map((week) => {
                        const value = channel.perWeek.get(week) ?? 0;
                        return (
                          <span
                            key={week}
                            className="flex-1 rounded-t-sm bg-primary/70"
                            style={{ height: `${Math.max(2, (value / peak) * 40)}px` }}
                          />
                        );
                      })}
                    </div>
                    <p className="sr-only">
                      {weeks
                        .map((week) =>
                          t("weekCount", {
                            week: format.dateTime(new Date(week), { dateStyle: "short" }),
                            count: channel.perWeek.get(week) ?? 0,
                          }),
                        )
                        .join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
