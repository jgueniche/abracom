#!/usr/bin/env node
/**
 * Builds `lib/practice/pictograms.generated.ts`, the pictures a practice sheet counts with.
 *
 *   node scripts/practice/build-pictograms.mjs
 *
 * Why pictograms rather than generated images (ADR-0087): an image model asked for « 7
 * pommes » does not reliably draw seven. On a CP worksheet that is the one mistake that would
 * cost the parents' trust, so whatever a child counts, matches or names is drawn by the
 * application from this fixed set, and the model only picks a key from it.
 *
 * The drawings are Microsoft's Fluent Emoji, flat style (MIT), read from the
 * `@iconify-json/fluent-emoji-flat` development dependency. Only the keys listed below are
 * kept, so the generated module stays small and the list the model chooses from stays
 * readable. Add a line here, run the script, commit both files.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "node_modules/@iconify-json/fluent-emoji-flat/icons.json");
const TARGET = path.join(ROOT, "lib/practice/pictograms.generated.ts");

/** key → [Fluent icon name, French, English]. Keys are what the model writes. */
const PICTOGRAMS = {
  // Fruits et légumes
  apple: ["red-apple", "pomme", "apple"],
  "green-apple": ["green-apple", "pomme verte", "green apple"],
  banana: ["banana", "banane", "banana"],
  pear: ["pear", "poire", "pear"],
  strawberry: ["strawberry", "fraise", "strawberry"],
  cherries: ["cherries", "cerises", "cherries"],
  grapes: ["grapes", "raisin", "grapes"],
  orange: ["tangerine", "orange", "orange"],
  lemon: ["lemon", "citron", "lemon"],
  watermelon: ["watermelon", "pastèque", "watermelon"],
  pineapple: ["pineapple", "ananas", "pineapple"],
  carrot: ["carrot", "carotte", "carrot"],
  tomato: ["tomato", "tomate", "tomato"],
  corn: ["ear-of-corn", "épi de maïs", "corn"],
  broccoli: ["broccoli", "brocoli", "broccoli"],
  mushroom: ["mushroom", "champignon", "mushroom"],
  chestnut: ["chestnut", "châtaigne", "chestnut"],
  // Animaux
  cat: ["cat-face", "chat", "cat"],
  dog: ["dog-face", "chien", "dog"],
  rabbit: ["rabbit-face", "lapin", "rabbit"],
  bird: ["bird", "oiseau", "bird"],
  fish: ["fish", "poisson", "fish"],
  "tropical-fish": ["tropical-fish", "poisson tropical", "tropical fish"],
  butterfly: ["butterfly", "papillon", "butterfly"],
  ladybug: ["lady-beetle", "coccinelle", "ladybug"],
  bee: ["honeybee", "abeille", "bee"],
  snail: ["snail", "escargot", "snail"],
  frog: ["frog", "grenouille", "frog"],
  turtle: ["turtle", "tortue", "turtle"],
  lion: ["lion", "lion", "lion"],
  elephant: ["elephant", "éléphant", "elephant"],
  giraffe: ["giraffe", "girafe", "giraffe"],
  monkey: ["monkey-face", "singe", "monkey"],
  bear: ["bear", "ours", "bear"],
  pig: ["pig-face", "cochon", "pig"],
  cow: ["cow-face", "vache", "cow"],
  horse: ["horse", "cheval", "horse"],
  sheep: ["ewe", "mouton", "sheep"],
  chicken: ["chicken", "poule", "chicken"],
  chick: ["hatching-chick", "poussin", "chick"],
  duck: ["duck", "canard", "duck"],
  owl: ["owl", "hibou", "owl"],
  penguin: ["penguin", "manchot", "penguin"],
  mouse: ["mouse-face", "souris", "mouse"],
  fox: ["fox", "renard", "fox"],
  hedgehog: ["hedgehog", "hérisson", "hedgehog"],
  squirrel: ["chipmunk", "écureuil", "squirrel"],
  whale: ["spouting-whale", "baleine", "whale"],
  dolphin: ["dolphin", "dauphin", "dolphin"],
  octopus: ["octopus", "pieuvre", "octopus"],
  crab: ["crab", "crabe", "crab"],
  snake: ["snake", "serpent", "snake"],
  unicorn: ["unicorn", "licorne", "unicorn"],
  dinosaur: ["sauropod", "dinosaure", "dinosaur"],
  // À l'école, à la maison
  ball: ["soccer-ball", "ballon", "ball"],
  basketball: ["basketball", "ballon de basket", "basketball"],
  balloon: ["balloon", "ballon de baudruche", "balloon"],
  book: ["open-book", "livre", "book"],
  books: ["books", "livres", "books"],
  pencil: ["pencil", "crayon", "pencil"],
  crayon: ["crayon", "craie grasse", "crayon"],
  scissors: ["scissors", "ciseaux", "scissors"],
  backpack: ["backpack", "cartable", "school bag"],
  ruler: ["straight-ruler", "règle", "ruler"],
  "set-square": ["triangular-ruler", "équerre", "set square"],
  abacus: ["abacus", "boulier", "abacus"],
  palette: ["artist-palette", "palette", "palette"],
  paintbrush: ["paintbrush", "pinceau", "paintbrush"],
  house: ["house", "maison", "house"],
  key: ["key", "clé", "key"],
  clock: ["alarm-clock", "réveil", "alarm clock"],
  bell: ["bell", "cloche", "bell"],
  gift: ["wrapped-gift", "cadeau", "gift"],
  teddy: ["teddy-bear", "nounours", "teddy bear"],
  kite: ["kite", "cerf-volant", "kite"],
  umbrella: ["umbrella", "parapluie", "umbrella"],
  shoe: ["running-shoe", "chaussure", "shoe"],
  socks: ["socks", "chaussettes", "socks"],
  tshirt: ["t-shirt", "tee-shirt", "T-shirt"],
  crown: ["crown", "couronne", "crown"],
  gem: ["gem-stone", "pierre précieuse", "gem"],
  trophy: ["trophy", "coupe", "trophy"],
  lightbulb: ["light-bulb", "ampoule", "light bulb"],
  magnifier: ["magnifying-glass-tilted-left", "loupe", "magnifying glass"],
  // Transports
  car: ["automobile", "voiture", "car"],
  bus: ["bus", "bus", "bus"],
  bicycle: ["bicycle", "vélo", "bicycle"],
  train: ["locomotive", "train", "train"],
  airplane: ["airplane", "avion", "airplane"],
  boat: ["sailboat", "bateau", "boat"],
  rocket: ["rocket", "fusée", "rocket"],
  // À manger
  cake: ["birthday-cake", "gâteau", "cake"],
  cookie: ["cookie", "biscuit", "cookie"],
  "ice-cream": ["soft-ice-cream", "glace", "ice cream"],
  lollipop: ["lollipop", "sucette", "lollipop"],
  candy: ["candy", "bonbon", "candy"],
  bread: ["bread", "pain", "bread"],
  cheese: ["cheese-wedge", "fromage", "cheese"],
  egg: ["egg", "œuf", "egg"],
  milk: ["glass-of-milk", "verre de lait", "glass of milk"],
  pizza: ["pizza", "pizza", "pizza"],
  // Nature
  sun: ["sun", "soleil", "sun"],
  moon: ["crescent-moon", "lune", "moon"],
  star: ["star", "étoile", "star"],
  cloud: ["cloud", "nuage", "cloud"],
  rainbow: ["rainbow", "arc-en-ciel", "rainbow"],
  snowflake: ["snowflake", "flocon", "snowflake"],
  droplet: ["droplet", "goutte", "drop"],
  fire: ["fire", "feu", "fire"],
  tulip: ["tulip", "tulipe", "tulip"],
  sunflower: ["sunflower", "tournesol", "sunflower"],
  blossom: ["blossom", "fleur", "flower"],
  tree: ["deciduous-tree", "arbre", "tree"],
  "fir-tree": ["evergreen-tree", "sapin", "fir tree"],
  leaf: ["maple-leaf", "feuille", "leaf"],
  "fallen-leaf": ["fallen-leaf", "feuille morte", "fallen leaf"],
  seedling: ["seedling", "pousse", "seedling"],
  cactus: ["cactus", "cactus", "cactus"],
  shell: ["spiral-shell", "coquillage", "shell"],
  wave: ["water-wave", "vague", "wave"],
  // Formes et couleurs
  "red-circle": ["red-circle", "rond rouge", "red circle"],
  "green-circle": ["green-circle", "rond vert", "green circle"],
  "yellow-circle": ["yellow-circle", "rond jaune", "yellow circle"],
  "blue-square": ["blue-square", "carré bleu", "blue square"],
  "orange-square": ["orange-square", "carré orange", "orange square"],
  "purple-square": ["purple-square", "carré violet", "purple square"],
  "red-triangle": ["red-triangle", "triangle rouge", "red triangle"],
  diamond: ["large-blue-diamond", "losange bleu", "blue diamond"],
  heart: ["red-heart", "cœur", "heart"],
  // Musique
  "musical-note": ["musical-note", "note de musique", "musical note"],
  guitar: ["guitar", "guitare", "guitar"],
  drum: ["drum", "tambour", "drum"],
  violin: ["violin", "violon", "violin"],
  trumpet: ["trumpet", "trompette", "trumpet"],
  // Fêtes et traditions
  menorah: ["menorah", "hanoukia", "menorah"],
  "star-of-david": ["star-of-david", "étoile de David", "star of David"],
  scroll: ["scroll", "rouleau", "scroll"],
  candle: ["candle", "bougie", "candle"],
};

const set = JSON.parse(await readFile(SOURCE, "utf8"));
const size = set.width ?? 32;
const out = {};
for (const [key, [icon, fr, en]] of Object.entries(PICTOGRAMS)) {
  const found = set.icons[icon] ?? set.icons[set.aliases?.[icon]?.parent];
  if (!found) throw new Error(`Fluent Emoji has no « ${icon} » (key ${key})`);
  out[key] = { fr, en, body: found.body, width: found.width ?? size, height: found.height ?? size };
}

const header = `// Generated by scripts/practice/build-pictograms.mjs — do not edit by hand.
// Drawings: Microsoft Fluent Emoji, flat style — MIT License, (c) Microsoft Corporation.
// https://github.com/microsoft/fluentui-emoji
`;
const body = `${header}
export const PICTOGRAMS = ${JSON.stringify(out, null, 2)} as const satisfies Record<
  string,
  { fr: string; en: string; body: string; width: number; height: number }
>;
`;
await writeFile(TARGET, body);
const bytes = Buffer.byteLength(body);
console.log(
  `${Object.keys(out).length} pictograms, ${(bytes / 1024).toFixed(0)} Ko → ${path.relative(ROOT, TARGET)}`,
);
