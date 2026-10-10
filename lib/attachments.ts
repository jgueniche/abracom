/**
 * What a screen needs to show a joined file — a page of a homework, a photo of a message —
 * whatever table it came from. Client-safe: only a shape and two small rules.
 */
export type AttachmentView = {
  id: string;
  kind: "image" | "pdf";
  /** The name the file had when it was sent, for a PDF's card and a download. */
  name: string;
  size: number | null;
  width: number | null;
  height: number | null;
  /** The average colour, painted while the picture loads. */
  color: string | null;
  /** A light rendition for lists — or the picture itself when none was made. */
  thumbUrl: string | null;
  /** The picture at full size, for the viewer and for printing. */
  url: string | null;
  /** Opens the file through a route that signs a fresh URL: a link that never expires. */
  href: string;
  downloadHref: string;
};

/** The ratio a thumbnail reserves before its picture arrives, kept between portrait and landscape. */
export function thumbRatio(view: Pick<AttachmentView, "width" | "height">): number {
  if (!view.width || !view.height) return 3 / 4;
  return Math.min(4 / 3, Math.max(9 / 16, view.width / view.height));
}

export function classMediaHref(path: string, download = false): string {
  return `/api/storage/class-media?path=${encodeURIComponent(path)}${download ? "&download=1" : ""}`;
}

export function messageMediaHref(path: string, name?: string, download = false): string {
  const query = new URLSearchParams({ path });
  if (download) {
    query.set("download", "1");
    if (name) query.set("name", name);
  }
  return `/api/storage/messages?${query.toString()}`;
}
