import { type NextRequest, NextResponse } from "next/server";

import { toCsv } from "@/lib/import/csv";
import { createClient } from "@/lib/supabase/server";

/** CSV of recipients with read / acknowledgement timestamps (staff only, enforced in SQL). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("announcement_recipients", { announcement: id });
  if (error) return new NextResponse(null, { status: 403 });
  const csv = toCsv(
    ["nom", "prenom", "role", "lu_le", "confirme_le"],
    (data ?? []).map((r) => [r.last_name, r.first_name, r.role, r.read_at ?? "", r.acked_at ?? ""]),
  );
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accuses-lecture-${id.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
