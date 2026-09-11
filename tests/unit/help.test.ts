import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  excerpt,
  filterBody,
  HELP_ROLES,
  HELP_TOPICS,
  normalize,
  parseArticle,
  plainText,
} from "@/lib/help/frontmatter.mjs";
import { outlineArticle } from "@/lib/help/outline";
import { helpRolesFor } from "@/lib/help/roles";
import { articleForRoute, matchesRoute } from "@/lib/help/routes";
import type { MembershipLike } from "@/lib/permissions";

const SCHOOL = "school-neuilly";
const HELP_DIR = path.join(process.cwd(), "content", "help");

const VALID = `---
title: Déclarer une absence
roles: [parent, guardian]
routes: [/classes/[classId]/absences]
topic: daily
keywords: [absence, retard]
since: 20
reviewed: 2026-09-11
---

Le premier paragraphe.

:::roles parent
Réservé aux parents.
:::

:::roles guardian
Réservé aux responsables.
:::
`;

describe("parseArticle", () => {
  it("reads the front matter and keeps the body", () => {
    const article = parseArticle("absences", VALID);
    expect(article.slug).toBe("absences");
    expect(article.title).toBe("Déclarer une absence");
    expect(article.roles).toEqual(["parent", "guardian"]);
    expect(article.routes).toEqual(["/classes/[classId]/absences"]);
    expect(article.since).toBe(20);
    expect(article.reviewed).toBe("2026-09-11");
    expect(article.body).toContain("Le premier paragraphe.");
  });

  it("expands `roles: all` to the six roles of the brief", () => {
    const article = parseArticle("x", VALID.replace("roles: [parent, guardian]", "roles: all"));
    expect(article.roles).toEqual([...HELP_ROLES]);
  });

  it("refuses an article that would silently go wrong", () => {
    const cases: [string, string, RegExp][] = [
      ["no front matter", "Rien du tout", /no front matter/],
      ["missing key", VALID.replace("since: 20\n", ""), /missing front-matter key: since/],
      [
        "unknown key",
        VALID.replace("topic: daily", "topic: daily\nauthor: moi"),
        /unknown front-matter key/,
      ],
      [
        "unknown role",
        VALID.replace("[parent, guardian]", "[parent, cousin]"),
        /unknown role "cousin"/,
      ],
      ["unknown topic", VALID.replace("topic: daily", "topic: divers"), /unknown topic/],
      [
        "relative route",
        VALID.replace("[/classes/[classId]/absences]", "[classes]"),
        /must start with/,
      ],
      ["bad date", VALID.replace("2026-09-11", "11\\/09\\/2026"), /reviewed must be/],
      [
        "unclosed block",
        `${VALID.split(":::roles")[0]}:::roles parent\nSans fin.\n`,
        /never closed/,
      ],
      [
        "nested block",
        VALID.replace("Réservé aux parents.\n:::", "Réservé aux parents."),
        /cannot contain another one/,
      ],
      ["stray close", `${VALID}\n:::\n`, /never opened/],
    ];
    for (const [name, source, message] of cases) {
      expect(() => parseArticle("x", source), name).toThrow(message);
    }
  });
});

describe("filterBody", () => {
  it("keeps only the paragraphs addressed to the reader", () => {
    const { body } = parseArticle("absences", VALID);
    const parent = filterBody(body, ["parent"]);
    expect(parent).toContain("Réservé aux parents.");
    expect(parent).not.toContain("Réservé aux responsables.");

    const guardian = filterBody(body, ["guardian"]);
    expect(guardian).toContain("Réservé aux responsables.");
    expect(guardian).not.toContain("Réservé aux parents.");

    // Someone holding both roles reads both.
    expect(filterBody(body, ["parent", "guardian"])).toContain("Réservé aux responsables.");
    // And the shared text survives every filtering.
    for (const roles of [["parent"], ["guardian"], ["teacher"]]) {
      expect(filterBody(body, roles)).toContain("Le premier paragraphe.");
    }
  });

  it("does not leave the gap of a dropped block behind", () => {
    expect(filterBody(parseArticle("a", VALID).body, ["teacher"])).not.toMatch(/\n{3}/);
  });
});

describe("plainText, excerpt and normalize", () => {
  it("strips markdown down to the words", () => {
    expect(plainText("## Titre\n\n- **gras** et `code`\n[lien](/x)")).toBe(
      "Titre\n\ngras et code\nlien",
    );
  });

  it("takes the first line as an excerpt and truncates on a word", () => {
    expect(excerpt("Une phrase courte.\n\nUne autre.")).toBe("Une phrase courte.");
    const long = excerpt(`${"mot ".repeat(80)}`, 40);
    expect(long.length).toBeLessThanOrEqual(41);
    expect(long.endsWith("…")).toBe(true);
  });

  it("ignores case and diacritics, like french_unaccent does in SQL", () => {
    expect(normalize("Déclarer une ABSENCE")).toBe("declarer une absence");
    expect(normalize("élève")).toBe("eleve");
  });
});

describe("helpRolesFor", () => {
  const active = (role: MembershipLike["role"]): MembershipLike => ({
    schoolId: SCHOOL,
    role,
    status: "active",
  });

  it("gives a reader the articles of every role they hold", () => {
    expect(helpRolesFor([active("parent")])).toEqual(["parent"]);
    expect(helpRolesFor([active("guardian")])).toEqual(["guardian"]);
    expect(helpRolesFor([active("parent"), active("teacher")])).toEqual(["parent", "teacher"]);
  });

  it("opens the direction and secretariat shelves to a super admin", () => {
    expect(helpRolesFor([active("super_admin")])).toEqual(["staff", "school_admin", "super_admin"]);
  });

  it("ignores memberships that are not active yet", () => {
    expect(helpRolesFor([{ schoolId: SCHOOL, role: "teacher", status: "invited" }])).toEqual([
      "parent",
    ]);
  });
});

describe("articleForRoute", () => {
  const articles = [
    { slug: "classes", routes: ["/classes", "/classes/[classId]"] },
    { slug: "absences", routes: ["/classes/[classId]/absences"] },
    { slug: "diary", routes: ["/devoirs", "/classes/[classId]/devoirs"] },
  ];

  it("matches dynamic segments", () => {
    expect(matchesRoute("/classes/[classId]/devoirs", "/classes/42/devoirs")).toBe(true);
    expect(matchesRoute("/classes/[classId]", "/classes/42/devoirs")).toBe(false);
    expect(matchesRoute("/classes", "/classes/")).toBe(true);
    expect(matchesRoute("/classes", "/classesx")).toBe(false);
  });

  it("prefers the most specific article", () => {
    expect(articleForRoute(articles, "/classes/42/absences")?.slug).toBe("absences");
    expect(articleForRoute(articles, "/classes/42")?.slug).toBe("classes");
    expect(articleForRoute(articles, "/agenda")).toBeNull();
  });
});

describe("outlineArticle", () => {
  it("keeps paragraphs and bullets in the order they were written", () => {
    expect(outlineArticle("Un **mot**.\nsuite\n\n- une puce\n\nAprès.")).toEqual([
      { kind: "paragraph", text: "Un mot. suite" },
      { kind: "bullet", text: "une puce" },
      { kind: "paragraph", text: "Après." },
    ]);
  });

  it("drops the role-block markers", () => {
    expect(outlineArticle(":::roles parent\nTexte.\n:::")).toEqual([
      { kind: "paragraph", text: "Texte." },
    ]);
  });
});

describe("the articles shipped with the application", () => {
  const files = readdirSync(HELP_DIR).filter((name) => name.endsWith(".md"));
  const articles = files.map((name) =>
    parseArticle(name.slice(0, -3), readFileSync(path.join(HELP_DIR, name), "utf8"), name),
  );

  it("all parse, and there are some", () => {
    expect(articles.length).toBeGreaterThan(0);
  });

  it("covers every role and every topic", () => {
    for (const role of HELP_ROLES) {
      expect(
        articles.some((a) => a.roles.includes(role)),
        role,
      ).toBe(true);
    }
    for (const topic of HELP_TOPICS) {
      expect(
        articles.some((a) => a.topic === topic),
        topic,
      ).toBe(true);
    }
  });

  it("never tells a read-only guardian to write", () => {
    // The four blockers of session 18 were all of this shape: an interface —
    // and a guide — offering a guardian a door the database keeps shut.
    const forbidden = [
      /nouveau message/i,
      /écrivez à/i,
      /réserv(ez|er) un créneau/i,
      /signez/i,
      /« déclarer/i,
    ];
    for (const article of articles.filter((a) => a.roles.includes("guardian"))) {
      const body = filterBody(article.body, ["guardian"]);
      for (const pattern of forbidden) {
        expect(pattern.test(body), `${article.slug} · ${pattern}`).toBe(false);
      }
    }
  });
});
