import { type NextRequest, NextResponse } from "next/server";

import { createSignedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_PATH } from "@/lib/uploads/shared";

/**
 * Redirects to a short-lived signed URL; the storage RLS policy checks thread membership.
 * `download=1` saves the file instead of opening it, under the `name` it was sent with.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const path = params.get("path") ?? "";
  if (!MESSAGE_PATH.test(path)) return new NextResponse(null, { status: 400 });
  const download =
    params.get("download") === "1"
      ? (params.get("name") ?? "").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 120) ||
        (path.split("/").pop() ?? "fichier")
      : undefined;
  const supabase = await createClient();
  const url = await createSignedUrl(supabase, "messages", path, download);
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
