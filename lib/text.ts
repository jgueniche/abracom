/**
 * Markdown reduced to a plain-text lead for list rows and cards.
 *
 * Lists used to render the whole Markdown body inline — a 400-word journal entry
 * with twelve photos was printed in full inside a feed — or show no excerpt at
 * all, which left the reader nothing to decide on but a title and three badges.
 */
export function plainExcerpt(markdown: string | null | undefined, max = 220): string {
  if (!markdown) return "";
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their label
    .replace(/^\s{0,3}>\s?/gm, "") // block quotes
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}[-*+]\s+/gm, "") // bullets
    .replace(/^\s{0,3}\d+\.\s+/gm, "") // ordered items
    .replace(/^\s{0,3}([-*_])\s*(\1\s*){2,}$/gm, " ") // rules
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
