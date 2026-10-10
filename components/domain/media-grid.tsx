import { attachmentViews } from "@/server/queries/attachments";

import { MediaGridView } from "./media-grid-view";

export type MediaItem = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  kind: "image" | "video" | "pdf";
  width: number | null;
  height: number | null;
  blurhash: string | null;
  caption: string | null;
  filename: string | null;
  size_bytes: number | null;
};

/**
 * Photos of a cahier de vie entry: private bucket, signed in one batch (10 min), the average
 * colour behind each frame while it loads, and the light rendition when the server made one.
 * In a list the grid stops at `limit` and says how many are left — and the viewer still goes
 * through all of them: the photos it hid used to be reachable from nowhere.
 */
export async function MediaGrid({
  items,
  title,
  canDelete = false,
  limit,
}: {
  items: MediaItem[];
  title: string;
  canDelete?: boolean;
  limit?: number;
}) {
  const images = items.filter((item) => item.kind === "image");
  if (images.length === 0) return null;
  const views = await attachmentViews(images);
  const ordered = images.flatMap((item) => {
    const view = views.get(item.id);
    return view ? [{ ...view, caption: item.caption }] : [];
  });
  return <MediaGridView items={ordered} title={title} canDelete={canDelete} limit={limit} />;
}
