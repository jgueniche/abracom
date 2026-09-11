/**
 * Markdown reduced to what the PDF renderer can draw: paragraphs and bullets,
 * in the order they were written. The previous outline (`lib/guides.ts`) kept
 * `##` sections with their paragraphs and their bullets in two separate lists,
 * which reordered any article that alternates the two — every one of them.
 */
export type HelpBlock = { kind: "paragraph" | "bullet"; text: string };

const EMPHASIS = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`/g;

/** Markdown emphasis carries no weight in the PDF: keep the words, drop the marks. */
function flatten(line: string): string {
  return line
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(EMPHASIS, (_match, ...groups) => groups.slice(0, 5).find((g) => g !== undefined) ?? "")
    .trim();
}

export function outlineArticle(markdown: string): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  let continues = false;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith(":::")) {
      continues = false;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      blocks.push({ kind: "paragraph", text: flatten(line.replace(/^#{1,6}\s+/, "")) });
      continues = false;
      continue;
    }
    if (/^([-*]|\d+\.)\s/.test(line)) {
      blocks.push({ kind: "bullet", text: flatten(line.replace(/^([-*]|\d+\.)\s+/, "")) });
      continues = false;
      continue;
    }
    // A paragraph wrapped over several source lines is one block; a blank line
    // between two paragraphs is what separates them.
    const previous = blocks.at(-1);
    if (continues && previous) previous.text = `${previous.text} ${flatten(line)}`.trim();
    else blocks.push({ kind: "paragraph", text: flatten(line) });
    continues = true;
  }
  return blocks.filter((block) => block.text !== "");
}
