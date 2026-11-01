/**
 * Two practice sheets as the model would send them: what the fake provider serves
 * (`PRACTICE_AI_PROVIDER=fake`), what the unit tests check `parseSheet` against, and what
 * `/dev/ui` lays out. Fictitious, like every piece of demonstration content (CLAUDE.md §9).
 */
export const SAMPLE_MATH_SHEET = {
  title: "Le verger de Mamie Rose",
  intro: "Les pommes sont mûres ! Aide Mamie Rose à les compter et à remplir ses paniers.",
  domain: "math",
  illustration: "A sunny orchard with apple trees and wicker baskets, flat children's book style.",
  parentTip:
    "Laissez votre enfant compter avec le doigt sur chaque pomme : c'est le geste qui compte, pas la vitesse.",
  exercises: [
    {
      kind: "count",
      instruction: "Compte et écris le nombre dans la case.",
      items: [
        { pictogram: "apple", count: 7 },
        { pictogram: "pear", count: 4 },
        { pictogram: "cherries", count: 9 },
      ],
    },
    {
      kind: "operations",
      instruction: "Calcule.",
      operations: [
        { left: 3, operator: "plus", right: 4 },
        { left: 6, operator: "plus", right: 2 },
        { left: 9, operator: "minus", right: 3 },
        { left: 5, operator: "minus", right: 5 },
      ],
      pictogram: "apple",
    },
    {
      kind: "sequence",
      instruction: "Complète les suites de nombres.",
      sequences: [
        { start: 2, step: 2, length: 8, blanks: [2, 5, 7] },
        { start: 30, step: -5, length: 6, blanks: [1, 4] },
      ],
    },
    {
      kind: "compare",
      instruction: "Écris <, > ou =.",
      pairs: [
        { left: 12, right: 21 },
        { left: 40, right: 39 },
        { left: 15, right: 15 },
      ],
    },
    { kind: "draw", instruction: "Dessine un panier avec 6 pommes." },
  ],
};

export const SAMPLE_FRENCH_SHEET = {
  title: "La chasse aux mots du jardin",
  intro: "Un petit escargot a perdu ses mots dans le jardin. Aide-le à les retrouver !",
  domain: "french",
  illustration:
    "A garden with a smiling snail, flowers and a watering can, flat children's book style.",
  parentTip:
    "Faites lire la poésie à voix haute deux fois, puis cachez une ligne : votre enfant la retrouve de mémoire.",
  exercises: [
    {
      kind: "read",
      instruction: "Écoute la poésie, puis lis-la à voix haute.",
      lang: "fr",
      form: "poem",
      title: "L'escargot",
      text: "Petit escargot\nPorte sur son dos\nSa maisonnette.\nAussitôt qu'il pleut,\nIl est tout heureux,\nIl sort sa tête.",
      audio: true,
      questions: [
        { prompt: "Que porte l'escargot sur son dos ?", answer: "Sa maisonnette." },
        { prompt: "Quand est-il heureux ?", answer: "Quand il pleut." },
      ],
    },
    {
      kind: "match",
      instruction: "Relie chaque mot à son image.",
      lang: "fr",
      pairs: [
        { word: "escargot", pictogram: "snail" },
        { word: "fleur", pictogram: "tulip" },
        { word: "soleil", pictogram: "sun" },
        { word: "nuage", pictogram: "cloud" },
      ],
      audio: true,
    },
    {
      kind: "fill",
      instruction: "Complète avec le bon mot.",
      lang: "fr",
      sentences: [
        { before: "L'escargot porte sa", answer: "maison", after: "sur son dos.", hint: "" },
        { before: "Quand il", answer: "pleut", after: ", il sort sa tête.", hint: "pleuvoir" },
      ],
    },
    {
      kind: "trace",
      instruction: "Recopie les mots en écriture attachée.",
      lang: "fr",
      lines: ["escargot", "maison", "pluie"],
    },
    {
      kind: "dictation",
      instruction: "Écoute chaque mot et écris-le.",
      lang: "fr",
      words: ["dos", "tête", "jardin"],
    },
  ],
};

export const SAMPLE_HEBREW_SHEET = {
  title: "Les lettres du jardin",
  intro: "Dans le jardin, chaque animal cache une lettre. Retrouve-les avec le petit chat !",
  domain: "hebrew",
  illustration: "A cat and a dog playing in a sunny garden, flat children's book style.",
  parentTip:
    "Faites écouter chaque mot, puis demandez à votre enfant de le répéter en montrant l'image.",
  exercises: [
    {
      kind: "match",
      instruction: "Écoute et relie chaque mot à son image.",
      lang: "he",
      pairs: [
        { word: "חָתוּל", pictogram: "cat" },
        { word: "כֶּלֶב", pictogram: "dog" },
        { word: "שֶׁמֶשׁ", pictogram: "sun" },
        { word: "תַּפּוּחַ", pictogram: "apple" },
      ],
      audio: true,
    },
    {
      kind: "trace",
      instruction: "Recopie les lettres et les mots.",
      lang: "he",
      lines: ["ש", "ת", "שָׁלוֹם"],
    },
    {
      kind: "choice",
      instruction: "Quelle lettre entends-tu au début du mot ?",
      lang: "he",
      questions: [
        { prompt: "שֶׁמֶשׁ", choices: ["ש", "ת"], answer: 0 },
        { prompt: "תַּפּוּחַ", choices: ["ש", "ת"], answer: 1 },
      ],
    },
  ],
};
