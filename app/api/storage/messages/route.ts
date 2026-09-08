import { type NextRequest, NextResponse } from "next/server";

import { createSignedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/** Redirects to a short-lived signed URL; the storage RLS policy checks thread membership. */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i.test(path))
    return new NextResponse(null, { status: 400 });
  const supabase = await createClient();
  const url = await createSignedUrl(supabase, "messages", path);
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
