import { describe, expect, it } from "vitest";

import fr from "@/messages/fr.json";

import { fallbackAnswer } from "@/lib/assistant/fallback";
import { allowedLink, planSchema, quickPlan, rulePlan } from "@/lib/assistant/plan";
import { ANSWER_SYSTEM, answerPrompt, plannerPrompt, readerBrief } from "@/lib/assistant/prompt";

const reader = {
  today: "2026-11-02",
  children: [
    { firstName: "Léa", className: "CP A" },
    { firstName: "Noam", className: "CE2" },
  ],
};

const tools = (question: string) => rulePlan(question, reader).calls.map((call) => call.tool);

describe("rulePlan — the plan made from the words of the question", () => {
  it("looks up tomorrow's homework, for the child it names", () => {
    const plan = rulePlan("Quels sont les devoirs de Lea pour demain ?", reader);
    expect(plan.calls).toEqual([
      { tool: "homework", args: { from: "2026-11-03", to: "2026-11-03", child: "Léa" } },
    ]);
  });

  it("reads the menu of the week, or of the next one", () => {
    expect(rulePlan("Qu'y a-t-il à la cantine ?", reader).calls[0]).toEqual({
      tool: "menus",
      args: { week: "2026-11-02" },
    });
    expect(rulePlan("Le menu de la semaine prochaine", reader).calls[0]!.args.week).toBe(
      "2026-11-09",
    );
  });

  it("pairs a how-to question with the help", () => {
    expect(tools("Comment signaler une absence ?")).toEqual(["absences", "help"]);
    expect(tools("Où trouver les circulaires ?")).toEqual(["announcements", "help"]);
  });

  it("reads the week's homework and calendar for « what is planned »", () => {
    expect(rulePlan("Qu'est-ce qui est prévu cette semaine ?", reader).calls).toEqual([
      { tool: "homework", args: { from: "2026-11-02", to: "2026-11-09" } },
      { tool: "agenda", args: { from: "2026-11-02", to: "2026-11-09" } },
    ]);
  });

  it("keeps today's absences to today", () => {
    expect(rulePlan("Quelles absences aujourd'hui ?", reader).calls).toEqual([
      { tool: "absences", args: { from: "2026-11-02", to: "2026-11-02" } },
    ]);
  });

  it("does not open the help for a plain factual question", () => {
    expect(tools("Quels devoirs pour demain ?")).toEqual(["homework"]);
  });

  it("falls back on the search and the help when nothing matches", () => {
    expect(tools("Kermesse de fin d'année")).toEqual(["search", "help"]);
  });

  it("never plans more than four calls", () => {
    const plan = rulePlan("Devoirs, menu, sortie, absence, annonce : comment tout voir ?", reader);
    expect(plan.calls.length).toBeLessThanOrEqual(4);
    expect(planSchema.safeParse(plan).success).toBe(true);
  });
});

describe("quickPlan — when the words of the question are enough", () => {
  it("answers the usual questions without asking the model", () => {
    for (const question of [
      "Quels devoirs pour demain ?",
      "Qu'y a-t-il à la cantine cette semaine ?",
      "Comment signaler une absence ?",
      "Quels sont les prochains événements ?",
    ]) {
      expect(quickPlan(question, reader), question).not.toBeNull();
    }
  });

  it("answers every suggested question without asking the model", () => {
    for (const question of Object.values(fr.assistant.suggestions)) {
      expect(quickPlan(question, reader), question).not.toBeNull();
    }
  });

  it("leaves to the model a date the rules cannot place", () => {
    for (const question of [
      "Quels devoirs pour jeudi ?",
      "Le menu de la semaine prochaine",
      "Quelles sorties le 12 décembre ?",
      "Les devoirs pendant les vacances",
    ]) {
      expect(quickPlan(question, reader), question).toBeNull();
    }
  });

  it("leaves to the model a question it does not recognise, or a follow-up", () => {
    expect(quickPlan("Kermesse de fin d'année", reader)).toBeNull();
    expect(quickPlan("Et pour Liam ?", reader)).toBeNull();
  });
});

describe("planSchema — what the model may ask for", () => {
  it("refuses a tool that does not exist", () => {
    expect(planSchema.safeParse({ calls: [{ tool: "messages", args: {} }] }).success).toBe(false);
  });

  it("refuses a date that is not a date", () => {
    const plan = { calls: [{ tool: "homework", args: { from: "demain" } }] };
    expect(planSchema.safeParse(plan).success).toBe(false);
  });

  it("refuses more than four calls", () => {
    const calls = Array.from({ length: 5 }, () => ({ tool: "help", args: {} }));
    expect(planSchema.safeParse({ calls }).success).toBe(false);
  });
});

describe("allowedLink — only the links the server handed over", () => {
  const allowed = new Set(["/devoirs", "/devoirs/abc", "/ecole/menus?semaine=2026-11-02"]);

  it("keeps a link of the list, with or without its anchor", () => {
    expect(allowedLink("/devoirs/abc", allowed)).toBe(true);
    expect(allowedLink("/devoirs#devoir-abc", allowed)).toBe(true);
    expect(allowedLink("/ecole/menus?semaine=2026-11-02", allowed)).toBe(true);
  });

  it("drops anything else the model might write", () => {
    expect(allowedLink("/devoirs/xyz", allowed)).toBe(false);
    expect(allowedLink("/admin", allowed)).toBe(false);
    expect(allowedLink("https://example.com/devoirs", allowed)).toBe(false);
    expect(allowedLink("//example.com/devoirs", allowed)).toBe(false);
    expect(allowedLink("javascript:alert(1)", allowed)).toBe(false);
  });
});

describe("prompts", () => {
  const brief = {
    today: "2026-11-02",
    weekday: "lundi",
    schoolName: "École test Kesher",
    roles: ["parent"],
    children: reader.children,
    teaching: [],
  };

  it("names the reader's children and nothing of other families", () => {
    const text = readerBrief(brief);
    expect(text).toContain("Léa (CP A), Noam (CE2)");
    expect(text).toContain("parent");
  });

  it("ends the planner prompt on the last question", () => {
    const text = plannerPrompt(brief, [{ role: "user", text: "Quels devoirs pour demain ?" }]);
    expect(text).toMatch(/Question : Quels devoirs pour demain \?\n\nQuels outils/);
  });

  it("gives the answer its results and its allowed links", () => {
    const text = answerPrompt(
      brief,
      [{ role: "user", text: "Menu ?" }],
      [{ tool: "menus", data: { days: [] } }],
      [{ label: "Menus de la semaine", href: "/ecole/menus" }],
    );
    expect(text).toContain('Résultats des outils (JSON) :\n[{"tool":"menus","data":{"days":[]}}]');
    expect(text).toContain("- [Menus de la semaine](/ecole/menus)");
  });

  it("tells the model it reads only, and may be wrong", () => {
    expect(ANSWER_SYSTEM).toMatch(/UNIQUEMENT des résultats d'outils/);
    expect(ANSWER_SYSTEM).toMatch(/Tu ne fais rien à la place de la personne/);
    expect(ANSWER_SYSTEM).toMatch(/peut se tromper/);
  });
});

describe("fallbackAnswer — an answer without the model", () => {
  const labels = fr.assistant.fallback;

  it("reads the tools back as lists, each title with its link", () => {
    const text = fallbackAnswer(
      [
        {
          tool: "homework",
          data: {
            items: [
              {
                title: "Fiche d'additions n° 3",
                subject: "Mathématiques",
                due_on: "2026-11-03",
                link: "/devoirs/abc",
              },
            ],
          },
        },
        {
          tool: "menus",
          data: { days: [{ day: "lundi", main_course: "Omelette", side: "Ratatouille" }] },
        },
      ],
      labels,
    );
    expect(text).toContain(
      "Les devoirs :\n- [Fiche d'additions n° 3](/devoirs/abc) — Mathématiques — mardi 3 novembre",
    );
    expect(text).toContain("Au menu :\n- lundi : Omelette, Ratatouille");
  });

  it("never draws a link that is not a path inside Kesher", () => {
    const text = fallbackAnswer(
      [{ tool: "help", data: { items: [{ title: "Piège", link: "https://example.com" }] } }],
      labels,
    );
    expect(text).toContain("- Piège");
    expect(text).not.toContain("example.com");
  });

  it("says when nothing was found", () => {
    expect(fallbackAnswer([{ tool: "homework", data: { items: [] } }], labels)).toBe(
      labels.nothing,
    );
  });
});
