import { type NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/import/csv";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The same reading as the screen, as a file. `late_report` refuses non-staff. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const { classId } = await params;
  if (!UUID.test(classId)) return new NextResponse(null, { status: 404 });
  await requireCurrentUser();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("school_id, name")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return new NextResponse(null, { status: 404 });

  const requested = Number(request.nextUrl.searchParams.get("jours"));
  const days = [30, 90, 365].includes(requested) ? requested : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("late_report", {
    school_: cls.school_id,
    from_: iso(from),
    to_: iso(to),
    class_: classId,
  });
  if (error) return new NextResponse(null, { status: 403 });

  const csv = toCsv(
    ["nom", "prenom", "classe", "retards_declares", "retards_constates", "dernier_retard"],
    (data ?? []).map((row) => [
      row.last_name,
      row.first_name,
      row.class_name ?? "",
      String(row.declared_late),
      String(row.observed_late),
      row.last_late ?? "",
    ]),
  );
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="retards-${classId.slice(0, 8)}-${days}j.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
