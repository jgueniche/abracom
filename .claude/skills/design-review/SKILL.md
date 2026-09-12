---
name: design-review
description: >-
  Revue de design pour Kesher — la doctrine de l'application (deux couches, trois
  largeurs, l'index plutôt que la carte, le filet plutôt que l'ombre) et la boucle
  de vérification qui trouve réellement les défauts : stack Supabase réelle,
  captures à 390 et 1440 px, clair et sombre, axe avant chaque commit. À charger
  avant toute session qui touche à l'interface, et avant de livrer un écran.
---

# Revue de design — Kesher

## 0. Qui arbitre

Cette compétence arbitre. `ui-ux-pro-max` (vendorisée dans `.claude/skills/ui-ux-pro-max/`)
est une **liste de contrôle et un corpus de référence**, pas une autorité : quand elle
contredit un ADR de `docs/DECISIONS.md`, l'ADR gagne, et on écrit pourquoi.

En particulier, **ne jamais** lancer son générateur de design system sur ce dépôt :
Kesher a déjà le sien, justifié dans les ADR 0031, 0032, 0051, 0052, 0053 et 0054,
et matérialisé par `app/globals.css`, `/dev/ui` et les composants partagés. Un second
document « Master » serait une seconde source de vérité, c'est-à-dire aucune.

Ce qui, chez elle, vaut la peine d'être lu :

- `references/quick-reference.md` §1–§2 (accessibilité et interaction, CRITICAL) —
  c'est la partie web, et elle couvre les critères **WCAG 2.2 AA** que ce projet
  n'avait jamais vérifiés explicitement.
- `references/pro-rules.md` — la liste avant livraison. Son cadrage est natif
  (iOS/Android) : la safe-area et le Dynamic Type ne s'appliquent pas ici, le reste si.
- `data/colors.csv` — palettes au format des jetons shadcn, utile comme **second avis**
  sur la nôtre, jamais comme remplacement.
- `data/typography.csv` — appariements du catalogue Google Fonts. À lire en sachant que
  Newsreader a été choisie pour son axe optique (ADR-0051) ; « Playfair Display pour le
  premium » est exactement le réflexe de catalogue qu'on a défait.

Interroger le corpus sans script : `grep -i "<terme>" .claude/skills/ui-ux-pro-max/data/*.csv`.
Les scripts Python de l'auteur n'ont **pas** été vendorisés (voir `PROVENANCE.md`).

## 1. La doctrine, en une page

### Deux couches (ADR-0054)

La **structure** parle plus fort que le **contenu**. C'est la règle qui a été prise à
l'envers une fois ; ne pas la reprendre à l'envers une seconde.

| Couche        | Quoi                                       | Taille                          | Poids                                            |
| ------------- | ------------------------------------------ | ------------------------------- | ------------------------------------------------ |
| **Structure** | onglet, barre du bas, filtre               | `text-[0.9375rem]` (15 px)      | `medium` au repos, `semibold` actif + filet 2 px |
| **Structure** | libellé de section (`SectionHeader`)       | 13 px capitales, `tracking` .06 | `semibold`, `text-foreground`                    |
| **Contenu**   | titre de carte / d'entrée d'index          | `text-base` (15 px)             | `normal`, serif `font-heading`                   |
| **Contenu**   | texte courant, `<Markdown size="compact">` | `text-sm` (14 px)               | interligne 1,6                                   |
| **Contenu**   | métadonnée, surtitre (`.meta`, `.eyebrow`) | 11–12 px                        | `muted-foreground`                               |

Plancher de contraste : **jamais sous `text-foreground/70`** pour de la navigation au
repos, jamais de `muted-foreground/xx` — la dilution d'un jeton déjà muet passe sous 4,5:1.

### Trois largeurs (ADR-0052)

Toute page porte une `<Column>`. Il n'y a pas d'exception « cet écran est spécial ».

- `text` (42 rem) — un formulaire, une circulaire, un article : ce qui se lit en entier.
- `index` (58 rem) — une liste qu'on parcourt. **C'est le défaut.**
- `full` — une console : tableau large, grille de pointage, deux volets de messagerie.

### La forme suit le contenu (ADR-0052)

| Le contenu est…                         | La forme est…                       |
| --------------------------------------- | ----------------------------------- |
| une suite de publications à parcourir   | `IndexList` / `IndexEntry`          |
| une suite d'objets semblables et courts | `RowList` / `Row`                   |
| un registre à colonnes                  | `Table`                             |
| un sommaire de destinations             | `HubCard` en lignes                 |
| **une grille de cartes**                | presque jamais — le prouver d'abord |

### Le trait plutôt que la boîte (ADR-0051)

`--radius: 8px`, le filet (`--rule`) au lieu de l'ombre, pas d'aplat pour marquer un
onglet. Ce qui attend le lecteur est **une barre de 2 px dans la marge**, pas une
pastille colorée. Une icône décorative par ligne : non. Un statut répété à l'identique
sur dix lignes : non — on ne nomme que l'exception.

## 2. La boucle qui trouve les défauts

Lire le code ne suffit pas : les quatre défauts sérieux des sessions 23 à 25 (marqueur
d'urgence dessiné hors d'une carte qui coupe, cahier de vie qui jetait le texte des
billets, 53 écrans sans largeur, deux contrastes cassés) ont tous été trouvés **en
regardant**, pas en relisant.

```bash
pnpm db:start                 # Docker requis ; le seed porte 137 comptes *@demo.local
pnpm dev                      # puis se connecter, mot de passe : demo-password
```

Comptes utiles : `parent-1@demo.local`, `guardian-005@demo.local`, `teacher-01@demo.local`,
`teacher-08@demo.local` (une conversation garnie), `staff@demo.local`, `admin@demo.local`,
`superadmin@demo.local`.

Captures et axe : Chromium est à `/opt/pw-browsers/chromium` (lancer avec `--no-sandbox`),
`@axe-core/playwright` est déjà installé.

**Avant de croire une capture, vérifier quel serveur la sert** — `ps aux | grep next` :
une session a passé une heure à regarder la sortie d'un `next-server` fantôme.

## 3. Liste avant livraison

Vérifier chaque point, sur la stack, avant de committer un écran.

### Structure

- [ ] La page porte une `<Column>` du bon genre
- [ ] Les onglets et libellés de section sont la ligne la plus forte de l'écran
- [ ] Aucune description d'en-tête ne répète le libellé de la section juste dessous
- [ ] Un fait sur l'écran passe par `caption`, pas par `description`

### Les deux thèmes, les deux largeurs

- [ ] Vu à **390 px** et à **1440 px**
- [ ] Vu en clair **et** en sombre — le contraste du sombre se mesure, il ne se déduit pas
- [ ] Filets et séparateurs visibles dans les deux thèmes
- [ ] Aucun défilement horizontal du corps de page

### Accessibilité (WCAG 2.2 AA)

- [ ] `axe` : 0 violation sérieuse ou critique, dans les deux thèmes
- [ ] Texte ≥ 4,5:1 ; navigation au repos jamais sous `foreground/70`
- [ ] Focus visible partout, et **jamais masqué** par la barre du bas ni l'en-tête collant (2.4.11)
- [ ] Cibles pointeur ≥ 24×24 px CSS (2.5.8) ; tactile ≥ 44 px (`min-h-11` / `size-11`)
- [ ] Titres séquentiels, un seul `h1` par page
- [ ] La couleur n'est jamais le seul porteur d'information
- [ ] Icône décorative à côté d'un texte : `aria-hidden` ; icône seule : nom accessible
- [ ] Champs d'authentification : le collage et les gestionnaires de mots de passe fonctionnent (3.3.8)
- [ ] `prefers-reduced-motion` respecté

### Interaction

- [ ] Les éléments cliquables ont `cursor-pointer` — **Tailwind v4 a changé le défaut des `<button>`**
- [ ] Les boutons d'action asynchrone se désactivent et montrent leur état
- [ ] Les états vide, chargement et erreur existent et disent quoi faire ensuite
- [ ] Aucun renvoi silencieux : une page qui ne peut rien montrer dit ce qui manque

### Le reste du dépôt

- [ ] Aucune chaîne en dur : tout passe par `next-intl`, `fr.json` **et** `en.json`
- [ ] L'article d'aide de l'écran touché est relu et son `reviewed:` remonté
- [ ] `pnpm check` puis `pnpm build` ; e2e si l'interface bouge
- [ ] `docs/DECISIONS.md` si une règle change, `CLAUDE.md` §10 et `docs/ROADMAP.md` en fin de session
