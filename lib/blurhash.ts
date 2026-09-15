/**
 * Average colour encoded in a blurhash, without decoding the whole image.
 *
 * Every photo stored a blurhash and none of them ever used it: thumbnails
 * loaded over a flat grey square. The DC component sits in characters 2–5 and
 * is already sRGB-encoded, so this is enough for a placeholder that looks like
 * the picture instead of like a hole.
 *
 * This lives apart from `lib/media.ts` on purpose. That module imports `sharp`, whose native
 * libvips weighs 16 Mo; a display component reaching in here for a placeholder colour used to
 * drag all of it into the function of every screen showing photos — `/devoirs` among them
 * (ADR-0066). Nothing here needs sharp: it is a base83 parse over four characters.
 */
const BASE83 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

export function blurhashAverageColor(hash: string | null | undefined): string | null {
  if (!hash || hash.length < 6) return null;
  let value = 0;
  for (const char of hash.slice(2, 6)) {
    const digit = BASE83.indexOf(char);
    if (digit < 0) return null;
    value = value * 83 + digit;
  }
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
