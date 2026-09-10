import { type NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { localTime } from "@/lib/calendar/dates";
import { toCsv } from "@/lib/import/csv";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * End-of-service summary, and nothing more: no billing (ADR-0039).
 * `attendance_roster` refuses anyone who may not point on the list, so the
 * export needs no check of its own beyond a signed-in caller.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!UUID.test(sessionId)) return new NextResponse(null, { status: 404 });
  const user = await requireCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_roster", { session_: sessionId });
  if (error) return new NextResponse(null, { status: 403 });

  // The school's clock, not the server's: 18:50 in Neuilly is 18:50 in the file.
  const timeZone = user.school?.timezone ?? "Europe/Paris";
  const time = (value: string | null) => (value ? localTime(value, timeZone) : "");
  const csv = toCsv(
    ["nom", "prenom", "classe", "statut", "arrivee", "depart", "recupere_par"],
    (data ?? []).map((row) => [
      row.last_name,
      row.first_name,
      row.class_name ?? "",
      row.status ?? "",
      time(row.arrived_at),
      time(row.departed_at),
      row.pickup_name ?? "",
    ]),
  );
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pointage-${sessionId.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
