import { type NextRequest, NextResponse } from "next/server";

import { BUCKETS, createSignedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/** Redirects to a short-lived signed URL (RLS decides whether the document is visible). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("storage_path, title")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });
  const url = await createSignedUrl(supabase, BUCKETS.documents, data.storage_path, data.title);
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
