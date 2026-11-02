/**
 * An answer written without the model (ADR-0088): the tool results read back as short lists,
 * each with its link. It is what the reader gets when Google does not answer in time — the
 * tools have already run under the reader's rights, so there is something true to show — and
 * the whole answer of the fake provider used in development and in the e2e suite.
 *
 * The labels come from the caller (`messages/*.json`, namespace `assistant.fallback`).
 */

export type FallbackLabels = {
  homework: string;
  menus: string;
  agenda: string;
  announcements: string;
  absences: string;
  help: string;
  search: string;
  nothing: string;
  toConfirm: string;
};

type Item = Record<string, unknown>;
type Result = { tool: string; data: unknown };

const MAX_ITEMS = 8;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function linked(label: string, href: unknown): string {
  // Brackets in a title would end the link early.
  const safe = label.replace(/[[\]]/g, "");
  return typeof href === "string" && href.startsWith("/") ? `[${safe}](${href})` : safe;
}

function dayOf(key: unknown, locale: string): string {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`));
}

function momentOf(iso: unknown, allDay: unknown, locale: string): string {
  if (typeof iso !== "string") return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
    timeZone: "Europe/Paris",
  }).format(date);
}

const joined = (...parts: string[]) => parts.filter(Boolean).join(" — ");

function lines(result: Result, labels: FallbackLabels, locale: string): string[] {
  const data = (result.data ?? {}) as { items?: Item[]; days?: Item[] };
  const items = (data.items ?? []).slice(0, MAX_ITEMS);
  switch (result.tool) {
    case "homework":
      return items.map((item) =>
        joined(linked(text(item.title), item.link), text(item.subject), dayOf(item.due_on, locale)),
      );
    case "menus":
      return (data.days ?? []).map((day) => {
        const dishes = [day.starter, day.main_course, day.side, day.dessert]
          .map(text)
          .filter(Boolean)
          .join(", ");
        return `${text(day.day)} : ${dishes}`;
      });
    case "agenda":
      return items.map((item) =>
        joined(linked(text(item.title), item.link), momentOf(item.starts_at, item.all_day, locale)),
      );
    case "announcements":
      return items.map((item) =>
        joined(
          linked(text(item.title), item.link),
          item.requires_ack && !item.acknowledged ? labels.toConfirm : "",
        ),
      );
    case "absences":
      return items.map((item) =>
        joined(text(item.student), dayOf(item.from, locale), dayOf(item.to, locale)),
      );
    case "help":
    case "search":
      return items.map((item) => linked(text(item.title), item.link));
    default:
      return [];
  }
}

export function fallbackAnswer(results: Result[], labels: FallbackLabels, locale = "fr-FR") {
  const blocks = results.flatMap((result) => {
    const list = lines(result, labels, locale).filter(Boolean);
    const title = labels[result.tool as keyof FallbackLabels];
    return list.length > 0 && title
      ? [`${title}\n${list.map((line) => `- ${line}`).join("\n")}`]
      : [];
  });
  return blocks.length > 0 ? blocks.join("\n\n") : labels.nothing;
}
