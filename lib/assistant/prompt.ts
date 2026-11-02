import { type AssistantLink, TOOL_GUIDE, TOOL_NAMES } from "./plan";

/**
 * What the assistant's model is told (ADR-0088). Two calls: the first chooses the tools, the
 * second answers from what they returned. The first is the same for everyone and ends with the
 * question, so a provider can keep it in cache.
 */

export type Turn = { role: "user" | "assistant"; text: string };

export type ReaderBrief = {
  today: string;
  weekday: string;
  schoolName: string | null;
  roles: string[];
  children: { firstName: string; className: string | null }[];
  teaching: string[];
};

const ROLE_NAMES: Record<string, string> = {
  super_admin: "administrateur de la plateforme",
  school_admin: "direction",
  staff: "secrétariat",
  teacher: "enseignant·e",
  parent: "parent",
  guardian: "responsable en lecture seule",
};

export function readerBrief(brief: ReaderBrief): string {
  const lines = [
    `Aujourd'hui : ${brief.weekday} ${brief.today} (heure de Paris).`,
    brief.schoolName ? `École : ${brief.schoolName}.` : null,
    `La personne qui écrit : ${brief.roles.map((role) => ROLE_NAMES[role] ?? role).join(", ") || "membre de l'école"}.`,
    brief.children.length > 0
      ? `Ses enfants : ${brief.children.map((c) => `${c.firstName}${c.className ? ` (${c.className})` : ""}`).join(", ")}.`
      : null,
    brief.teaching.length > 0 ? `Ses classes : ${brief.teaching.join(", ")}.` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function conversation(turns: Turn[]): string {
  return turns
    .map((turn) => `${turn.role === "user" ? "Question" : "Réponse"} : ${turn.text}`)
    .join("\n");
}

export const PLANNER_SYSTEM = `Tu es le planificateur de l'assistant de Kesher, l'application d'une école primaire (familles, enseignants, direction). Tu ne réponds pas à la personne : tu choisis quels outils interroger pour pouvoir lui répondre.

Outils disponibles (tous en lecture seule, limités à ce que la personne a le droit de voir) :
${TOOL_NAMES.map((name) => `- ${name} : ${TOOL_GUIDE[name]}`).join("\n")}

Règles :
- Au plus 4 appels. Aucun appel si la question n'a besoin d'aucune donnée (salutation, remerciement).
- Les dates au format AAAA-MM-JJ, calculées à partir d'« aujourd'hui » : « demain », « cette semaine », « lundi prochain »…
- « help » pour toute question sur la manière de faire quelque chose dans l'application ou sur l'endroit où le trouver.
- Les messages privés et les évaluations ne sont pas accessibles : n'essaie pas de les chercher.

Réponds UNIQUEMENT par un objet JSON de la forme :
{"calls": [{"tool": "homework", "args": {"from": "2026-11-03", "to": "2026-11-03", "child": "Léa"}}]}`;

export function plannerPrompt(brief: ReaderBrief, turns: Turn[]): string {
  return `${readerBrief(brief)}\n\nConversation :\n${conversation(turns)}\n\nQuels outils pour répondre à la dernière question ?`;
}

export const ANSWER_SYSTEM = `Tu es l'assistant de Kesher, l'application de l'école. Tu aides la personne à trouver une information et à s'orienter dans l'application.

Ce que tu sais vient UNIQUEMENT des résultats d'outils fournis ci-dessous, qui ne contiennent que ce que la personne a le droit de voir. Règles :
- Réponds dans la langue de la question (français par défaut), en 1 à 6 phrases courtes ou une petite liste. Pas de titre.
- N'invente rien : ni devoir, ni date, ni menu, ni événement, ni règle de l'école. Si les résultats ne contiennent pas la réponse, dis-le simplement et indique l'écran où regarder.
- Les liens : uniquement ceux de la liste « Liens autorisés », écrits en Markdown [libellé](/chemin). Jamais d'autre adresse.
- Tu ne fais rien à la place de la personne (envoyer un message, déclarer une absence, signer) : tu expliques où le faire, avec le lien.
- Tu ne parles jamais d'autres familles ni d'autres enfants que ceux de la personne.
- Pas d'avis médical, juridique ou sur un enfant ; pas d'évaluation d'un élève.
- Si l'on te demande qui tu es : un assistant à intelligence artificielle de Kesher, qui peut se tromper.`;

export function answerPrompt(
  brief: ReaderBrief,
  turns: Turn[],
  results: unknown,
  links: AssistantLink[],
): string {
  return [
    readerBrief(brief),
    `Résultats des outils (JSON) :\n${JSON.stringify(results)}`,
    `Liens autorisés :\n${links.map((link) => `- [${link.label}](${link.href})`).join("\n")}`,
    `Conversation :\n${conversation(turns)}`,
    "Réponds à la dernière question.",
  ].join("\n\n");
}
