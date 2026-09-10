import { getFormatter, getTranslations } from "next-intl/server";

import { getChildAttendance } from "@/server/queries/attendance";

/**
 * What a family follows of their child: the after-school club and the outings
 * (arbitrage 5). The classroom roll call never appears here — a live presence
 * feed of the school day is surveillance, not information.
 * Renders nothing when there is nothing to show.
 */
export async function ChildAttendance({ studentId }: { studentId: string }) {
  const rows = await getChildAttendance(studentId, 14).catch(() => []);
  if (rows.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations("attendance"), getFormatter()]);
  const time = (value: string | null) =>
    value ? format.dateTime(new Date(value), { timeStyle: "short" }) : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <h3 className="mb-2 text-sm font-semibold">{t("familyTitle")}</h3>
      <ul className="flex flex-col gap-2">
        {rows.slice(0, 6).map((row, index) => (
          <li
            key={`${row.on_date}-${index}`}
            className="flex flex-wrap items-baseline gap-x-2 text-sm"
          >
            <span className="text-muted-foreground tabular-nums">
              {format.dateTime(new Date(`${row.on_date}T12:00:00`), {
                day: "numeric",
                month: "short",
              })}
            </span>
            <span className="font-medium">{row.list_name}</span>
            <span className="text-muted-foreground">
              {row.arrived_at && time(row.arrived_at)
                ? t("arrivedAt", { time: time(row.arrived_at)! })
                : t(`statuses.${row.status}`)}
              {row.departed_at && time(row.departed_at)
                ? ` · ${t("leftAt", { time: time(row.departed_at)! })}`
                : ""}
              {row.pickup_name ? ` · ${row.pickup_name}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
