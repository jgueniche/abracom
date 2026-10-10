import { type NextRequest, NextResponse } from "next/server";

import { BUCKETS, createSignedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { CLASS_MEDIA_PATH } from "@/lib/uploads/shared";

/**
 * Opens — or, with `download=1`, downloads — a page joined to a homework or a photo of the
 * cahier de vie, through a signed URL of ten minutes.
 *
 * Lists sign their thumbnails in one batch when they render; this route serves the click, so a
 * link left open for an hour still works. The file is looked up through `class_post_media`, so
 * the policies of the publication decide (a draft, a post for the team only), not merely the
 * class folder the Storage policy reads.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const download = request.nextUrl.searchParams.get("download") === "1";
  if (!CLASS_MEDIA_PATH.test(path)) return new NextResponse(null, { status: 400 });

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("class_post_media")
    .select("storage_path, kind, filename")
    .eq("storage_path", path)
    .maybeSingle();
  if (!media) return new NextResponse(null, { status: 404 });

  // A photo is stored as WebP whatever it was sent as: the name it is saved under says so.
  const base = (media.filename ?? path.split("/").pop() ?? "fichier").replace(/\.[^.]*$/, "");
  const name = media.kind === "image" ? `${base}.webp` : (media.filename ?? `${base}.pdf`);
  const url = await createSignedUrl(
    supabase,
    BUCKETS.classMedia,
    path,
    download ? name : undefined,
  );
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
