import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Right of access and portability (RGPD art. 15 and 20): one JSON document, computed under RLS. */
export async function GET() {
  await requireCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return NextResponse.json({ error: "export failed" }, { status: 500 });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kesher-export-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
