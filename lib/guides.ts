import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export const GUIDE_SLUGS = ["parents", "enseignants", "direction"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(value);
}

/** Guides are versioned Markdown files (content/guides), rendered in-app and exported to PDF. */
export async function readGuide(slug: GuideSlug): Promise<string> {
  return readFile(path.join(process.cwd(), "content", "guides", `${slug}.md`), "utf8");
}

export type GuideSection = { heading: string; paragraphs: string[]; bullets: string[] };

/** Minimal Markdown outline (title, ## sections, paragraphs, "- " bullets) for the PDF renderer. */
export function outlineGuide(markdown: string): { title: string; sections: GuideSection[] } {
  let title = "";
  const sections: GuideSection[] = [];
  let current: GuideSection | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
    } else if (line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), paragraphs: [], bullets: [] };
      sections.push(current);
    } else if (line.startsWith("- ")) {
      current?.bullets.push(line.slice(2).trim());
    } else if (line !== "") {
      current?.paragraphs.push(line);
    }
  }
  return { title, sections };
}
