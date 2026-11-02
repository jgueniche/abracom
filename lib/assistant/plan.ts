import { z } from "zod";

import { addDays, type DateKey, mondayOf } from "@/lib/calendar/dates";

/**
 * What the assistant may look up, and how it decides (ADR-0088).
 *
 * Seven read-only tools, each a query the application already runs for its own screens, run
 * with the reader's own session: the policies decide what comes back, exactly as on screen. No
 * tool writes, none reads a private conversation or an assessment. A first call asks the model
 * which tools a question needs (`planSchema`); a rule-based plan (`rulePlan`) answers when the
 * model cannot, and serves the fake provider of development and tests.
 */

export const TOOL_NAMES = [
  "homework",
  "agenda",
  "menus",
  "announcements",
  "absences",
  "help",
  "search",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const toolArgsSchema = z
  .object({
    from: dateKey,
    to: dateKey,
    week: dateKey,
    child: z.string().trim().max(60),
    query: z.string().trim().max(200),
  })
  .partial();
export type ToolArgs = z.infer<typeof toolArgsSchema>;

export const planSchema = z.object({
  calls: z.array(z.object({ tool: z.enum(TOOL_NAMES), args: toolArgsSchema.default({}) })).max(4),
});
export type Plan = z.infer<typeof planSchema>;

/** What each tool is for, as the planner reads it. */
export const TOOL_GUIDE: Record<ToolName, string> = {
  homework:
    "Devoirs des classes du lecteur. args : from, to (dates AAAA-MM-JJ, échéance incluse), child (prénom, facultatif).",
  agenda: "Événements de l'agenda visibles par le lecteur. args : from, to.",
  menus: "Menus de la cantine d'une semaine. args : week (une date de la semaine).",
  announcements: "Annonces et circulaires récentes de l'école, et celles qui attendent un accusé.",
  absences:
    "Absences et retards que le lecteur peut voir (ses enfants, ou les classes de l'équipe). args : from, to, child.",
  help: "Mode d'emploi de Kesher pour le rôle du lecteur : comment faire, où trouver. args : query.",
  search: "Recherche dans les annonces, publications, événements et documents. args : query.",
};

export type ReaderSummary = {
  today: DateKey;
  children: { firstName: string; className: string | null }[];
};

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * A plan from the words of the question alone: the fallback when the model is unreachable or
 * answers something that does not parse, and the whole planner of the fake provider.
 */
export function rulePlan(question: string, reader: ReaderSummary): Plan {
  const q = fold(question);
  const { today } = reader;
  const child = reader.children.find((c) => q.includes(fold(c.firstName)))?.firstName;
  const calls: Plan["calls"] = [];
  const tomorrow = addDays(today, 1);

  const week = /prevu|programme|cette semaine/.test(q);
  if (/devoir|lecon|exercice|poesie|cahier de texte|a faire|reciter|apprendre/.test(q) || week) {
    const range = /demain/.test(q)
      ? { from: tomorrow, to: tomorrow }
      : /aujourd/.test(q)
        ? { from: today, to: today }
        : { from: today, to: addDays(today, 7) };
    calls.push({ tool: "homework", args: { ...range, ...(child ? { child } : {}) } });
  }
  if (/cantine|menu|manger|dejeuner|repas|gouter/.test(q)) {
    calls.push({
      tool: "menus",
      args: { week: mondayOf(/semaine prochaine/.test(q) ? addDays(today, 7) : today) },
    });
  }
  if (/agenda|evenement|sortie|fete|reunion|vacances|calendrier|spectacle|rendez/.test(q) || week) {
    calls.push({ tool: "agenda", args: { from: today, to: addDays(today, week ? 7 : 30) } });
  }
  if (/absen|retard|malade/.test(q)) {
    const range = /aujourd/.test(q)
      ? { from: today, to: today }
      : { from: addDays(today, -30), to: addDays(today, 7) };
    calls.push({ tool: "absences", args: { ...range, ...(child ? { child } : {}) } });
  }
  if (/annonce|circulaire|information|signer|accuse/.test(q)) {
    calls.push({ tool: "announcements", args: {} });
  }
  if (
    /comment|ou trouver|ou est|aide|je peux|faire pour|declarer|signaler|changer|modifier|ou se trouve|how|where/.test(
      q,
    ) &&
    calls.length < 3
  ) {
    calls.push({ tool: "help", args: { query: question.slice(0, 200) } });
  }
  if (calls.length === 0) {
    calls.push({ tool: "search", args: { query: question.slice(0, 200) } });
    calls.push({ tool: "help", args: { query: question.slice(0, 200) } });
  }
  return { calls: calls.slice(0, 4) };
}

export type AssistantLink = { label: string; href: string };

/** Whether a link of an answer may be shown: one the server handed over, and inside Kesher. */
export function allowedLink(href: string, allowed: ReadonlySet<string>): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  const path = href.split("#")[0]!;
  return allowed.has(href) || allowed.has(path);
}
