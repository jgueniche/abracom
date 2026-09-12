import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { setAttendanceSessionState } from "@/server/actions/attendance";
import {
  getAttendanceRoster,
  getAttendanceSession,
  getPickupOptions,
} from "@/server/queries/attendance";

import { AttendanceGrid, type GridStudent } from "./_components/attendance-grid";

export default async function AttendanceSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  await requireCurrentUser();
  const [t, format, session] = await Promise.all([
    getTranslations("attendance"),
    getFormatter(),
    getAttendanceSession(sessionId),
  ]);
  if (!session?.list) notFound();

  // `attendance_roster` refuses anyone who may not point on the list.
  const roster = await getAttendanceRoster(sessionId).catch(() => null);
  if (!roster) notFound();

  const pickup = session.list.records_pickup
    ? await getPickupOptions(roster.map((row) => row.student_id))
    : new Map();

  const students: GridStudent[] = roster.map((row) => ({
    id: row.student_id,
    firstName: row.first_name,
    lastName: row.last_name,
    className: row.class_name,
    status: row.status,
    arrivedAt: row.arrived_at,
    departedAt: row.departed_at,
    pickupUserId: row.pickup_user_id,
    pickupName: row.pickup_name,
    declaredAbsent: row.declared_absent ?? false,
    pickupOptions: (pickup.get(row.student_id) ?? []).map(
      (option: { user_id: string; full_name: string }) => ({
        userId: option.user_id,
        name: option.full_name,
      }),
    ),
  }));

  const closed = session.closed_at !== null;

  return (
    <Column width="full">
      <PageHeader
        eyebrow={
          <Link href="/pointage" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" aria-hidden />
            {t("backToLists")}
          </Link>
        }
        title={session.list.name}
        description={format.dateTime(new Date(`${session.on_date}T12:00:00`), {
          dateStyle: "full",
        })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/pointage/${sessionId}/export`} prefetch={false}>
                <DownloadIcon aria-hidden />
                {t("exportCsv")}
              </Link>
            </Button>
            <form action={setAttendanceSessionState}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="reopen" value={String(closed)} />
              <Button type="submit" variant={closed ? "outline" : "default"} className="min-h-11">
                {closed ? t("reopen") : t("closeSession")}
              </Button>
            </form>
          </div>
        }
      />
      <AttendanceGrid
        sessionId={sessionId}
        students={students}
        recordsPickup={session.list.records_pickup}
        closed={closed}
      />
    </Column>
  );
}
