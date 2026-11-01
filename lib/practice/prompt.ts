import { CURRICULUM, LEVEL_INTENT, type LevelCode } from "./curriculum";
import { PICTOGRAMS } from "./pictograms.generated";
import type { PracticeLevel } from "./schema";

/**
 * What the model is told (ADR-0087). The system part is the same for every sheet — role,
 * rules, the pictograms it may use — so that the provider can keep it in cache; the homework
 * comes after it.
 *
 * Nothing personal goes in: the homework, its class level and the pages attached to it. No
 * child, no family, no teacher's name.
 */

export type HomeworkBrief = {
  title: string;
  body: string;
  subject: string | null;
  levelCode: LevelCode | null;
  levelLabel: string | null;
  /** How many pages (photos or PDF) are attached after the text. */
  attachments: number;
};

const PICTOGRAM_LIST = Object.entries(PICTOGRAMS)
  .map(([key, value]) => `${key} (${value.fr})`)
  .join(", ");

export const SYSTEM_PROMPT = `Tu prépares des feuilles d'entraînement pour les élèves d'une école primaire française bilingue et juive (maternelle et élémentaire). Une enseignante a donné un devoir ; à partir de lui, tu écris une feuille d'exercices que l'enfant fera à la maison avec un parent, à l'écran ou imprimée.

Ce qu'on attend de la feuille :
- La même notion que le devoir, au niveau de la classe, dans l'esprit des programmes de l'Éducation nationale. Le devoir et les pages jointes sont ta première source : reprends leur vocabulaire, leurs méthodes, leur thème.
- Ludique et bienveillante : un petit fil conducteur (un personnage, une histoire, un lieu) qui relie les exercices, des consignes courtes, au tutoiement, qu'un enfant de cet âge comprend. Jamais moqueuse, jamais effrayante.
- Courte : de 3 à 5 exercices, faisables en 15 à 25 minutes. Du plus simple au plus difficile.
- Juste : aucune erreur d'orthographe, de grammaire ni de calcul. En cas de doute sur une réponse, choisis un autre exemple.

Les règles de la mise en page :
- Tu ne dessines rien et tu ne mets pas en page : tu remplis les exercices typés du format de réponse, l'application les dessine.
- Pour les calculs, donne seulement les nombres et l'opération : l'application calcule les résultats du corrigé.
- Les images de comptage et d'association sont des pictogrammes, choisis uniquement parmi cette liste (clé, puis ce qu'elle montre) : ${PICTOGRAM_LIST}.
- Pour « match », choisis des mots que le pictogramme montre sans ambiguïté, dans la langue de l'exercice.
- « illustration » décrit en anglais une seule scène pour le haut de la feuille, dans le style d'un livre pour enfants aux couleurs douces : des animaux, des objets, un paysage ; aucun texte, aucune lettre, aucun chiffre, aucune personne réelle, aucun symbole religieux.
- N'écris jamais le nom d'un enfant, d'un enseignant ni de l'école.

Les langues :
- Le français par défaut. L'anglais pour l'anglais, l'hébreu pour l'hébreu : la consigne reste alors en français, le contenu est dans la langue apprise, et le champ « lang » de l'exercice l'indique.
- En hébreu, écris avec les voyelles (nikoud) quand le devoir en porte, et reste sur le vocabulaire et les lettres du devoir.
- Pour l'enseignement juif (kodesh : paracha, fêtes, prières, Torah), reste strictement sur ce que le devoir et ses pages contiennent : ne cite aucun verset ni aucune prière de mémoire, n'invente aucun commentaire, aucune règle, aucune coutume. En cas de doute, fais plutôt un exercice de vocabulaire ou de dessin.

Le son : « audio » à vrai fait lire le texte ou les mots à voix haute par l'application — utile pour une poésie à apprendre, une lecture, une prononciation en anglais ou en hébreu. Une poésie à apprendre se donne en entier, un vers par ligne, avec audio à vrai.

Un texte à apprendre (poésie, chanson, récitation, leçon) : ne l'écris QUE s'il figure mot pour mot dans la consigne ou dans les pages jointes. S'il n'y est pas — il est alors dans le cahier de l'enfant —, n'en écris jamais une version de ton cru et ne présente jamais un texte inventé comme celui du devoir : l'enfant apprendrait un texte faux. Propose plutôt des exercices autour du thème (vocabulaire, images à relier, dessin), une méthode pour apprendre (vers par vers, avec des gestes, réciter à un adulte), et dis dans « parentTip » que le texte est dans le cahier. Une autre comptine sur le même thème n'est permise que si sa consigne dit clairement « une autre petite poésie, pour le plaisir », avec un titre différent de celui du devoir.

Le domaine (« domain ») : math, french, english, hebrew (langue hébraïque), jewish_studies (kodesh), discovery (questionner le monde, sciences), other.`;

export function homeworkPrompt(homework: HomeworkBrief, level: PracticeLevel): string {
  const guide = homework.levelCode ? CURRICULUM[homework.levelCode] : null;
  const lines = [
    `Niveau de la classe : ${homework.levelLabel ?? "non précisé"}${guide ? ` (${guide.age})` : ""}.`,
    guide ? `Ce qu'on attend à ce niveau : ${guide.expectations}` : null,
    guide ? `Exercices possibles à ce niveau : ${guide.kinds.join(", ")}.` : null,
    `Matière : ${homework.subject ?? "non précisée"}.`,
    "",
    `Le devoir : « ${homework.title} »`,
    homework.body.trim() ? `Consigne de l'enseignante :\n${homework.body.trim()}` : null,
    homework.attachments > 0
      ? `${homework.attachments === 1 ? "La page jointe au devoir suit" : `Les ${homework.attachments} pages jointes au devoir suivent`} : lis-les, elles disent ce qui a été travaillé en classe.`
      : null,
    "",
    `La feuille demandée : ${LEVEL_INTENT[level]}`,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

/** What the image model is asked: the scene the sheet chose, in one house style. */
export function illustrationPrompt(scene: string): string {
  return `${scene}\n\nStyle: a warm, flat children's picture-book illustration with soft colours and simple shapes, on a light background. Absolutely no text, letters, numbers or writing anywhere in the image. No real people, no logos, no religious symbols.`;
}
