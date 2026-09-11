import { normalize } from "@/lib/help/frontmatter.mjs";
import type { HelpSearchEntry } from "@/lib/help/select";

/** An entry with its text folded once — lower case, no diacritics. */
export type IndexedEntry = HelpSearchEntry & {
  normalizedTitle: string;
  normalizedKeywords: string;
  normalizedText: string;
};

export type HelpMatch = {
  entry: HelpSearchEntry;
  /** The passage to show, and where the query words fall inside it. */
  snippet: string;
  ranges: [number, number][];
};

export function buildIndex(entries: readonly HelpSearchEntry[]): IndexedEntry[] {
  return entries.map((entry) => ({
    ...entry,
    normalizedTitle: normalize(entry.title),
    normalizedKeywords: normalize(entry.keywords.join(" ")),
    normalizedText: normalize(entry.text),
  }));
}

export function queryTerms(query: string): string[] {
  return normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1);
}

/** Title first, then keywords, then the body: a question matches its article. */
function scoreOf(entry: IndexedEntry, terms: readonly string[]): number {
  let score = 0;
  for (const term of terms) {
    if (entry.normalizedTitle.includes(term)) score += 10;
    else if (entry.normalizedKeywords.includes(term)) score += 5;
    else if (entry.normalizedText.includes(term)) score += 1;
    else return 0; // every word must be somewhere: "fermer messagerie" is one question
  }
  return score;
}

const WINDOW = 170;

/**
 * A passage around the first word found, with the ranges to highlight.
 *
 * Removing a diacritic keeps the character count (`é` → `e`), so an index in
 * the folded text points at the same place in the original — except for the
 * rare character that does not decompose, where the guard below falls back to
 * the excerpt rather than highlighting the wrong letters.
 */
function snippetOf(entry: IndexedEntry, terms: readonly string[]): HelpMatch {
  const aligned = entry.normalizedText.length === entry.text.length;
  const first = terms
    .map((term) => entry.normalizedText.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (!aligned || first === undefined) {
    return { entry, snippet: entry.excerpt, ranges: [] };
  }

  let start = Math.max(0, first - 60);
  if (start > 0) {
    const space = entry.text.indexOf(" ", start);
    start = space === -1 ? start : space + 1;
  }
  const end = Math.min(entry.text.length, start + WINDOW);

  // Every shift the passage applies to the original text has to be undone on
  // the ranges, or a highlight lands one word to the left: the window start,
  // the whitespace `trim()` eats, and the leading ellipsis.
  const raw = entry.text.slice(start, end);
  const trimmed = raw.trimStart();
  const prefix = start > 0 ? "…" : "";
  const body = trimmed.trimEnd();
  const snippet = `${prefix}${body}${end < entry.text.length ? "…" : ""}`;
  const offset = prefix.length - start - (raw.length - trimmed.length);

  const ranges: [number, number][] = [];
  for (const term of terms) {
    let index = entry.normalizedText.indexOf(term, start);
    // Only whole occurrences inside the window: half a word marked is noise.
    while (index !== -1 && index + term.length <= end) {
      ranges.push([index + offset, index + offset + term.length]);
      index = entry.normalizedText.indexOf(term, index + term.length);
    }
  }
  return {
    entry,
    snippet,
    ranges: mergeRanges(ranges, prefix.length, prefix.length + body.length),
  };
}

function mergeRanges(ranges: [number, number][], lower: number, upper: number): [number, number][] {
  const clamped = ranges
    .filter(([from, to]) => from >= lower && to <= upper)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of clamped) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Ranked matches for a query, empty when the query is too short. */
export function searchHelp(index: readonly IndexedEntry[], query: string, limit = 20): HelpMatch[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  return index
    .map((entry) => ({ entry, score: scoreOf(entry, terms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "fr"))
    .slice(0, limit)
    .map((row) => snippetOf(row.entry as IndexedEntry, terms));
}
