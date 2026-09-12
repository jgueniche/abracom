# Provenance

Copie de `nextlevelbuilder/ui-ux-pro-max-skill` (licence MIT, voir `LICENSE`),
récupérée le 2026-09-12 depuis `raw.githubusercontent.com` et le miroir jsDelivr.

## Ce qui a été gardé

Le corpus (`data/*.csv`), les deux références (`references/pro-rules.md`,
`references/quick-reference.md`) et `SKILL.md`.

## Ce qui n'a pas été gardé, et pourquoi

Les scripts Python de l'auteur (`scripts/search.py`, `design_system.py`, `core.py`
et leurs dépendances). Deux raisons.

1. **On n'en a pas besoin.** La valeur de ce dépôt est le corpus et les listes de
   contrôle ; le script n'est qu'un classement BM25 sur des CSV. Un `grep` sur
   `data/*.csv` fait le même travail sans exécuter de code tiers.
2. **On ne veut pas l'exécuter.** Kesher traite des données de mineurs. Vendoriser
   une centaine de kilo-octets de Python tiers dans le dépôt, exécuté par toutes les
   sessions à venir, n'est pas un risque qui se justifie pour un moteur de recherche
   sur vingt fichiers CSV.

## Comment s'en servir

Voir `.claude/skills/design-review/SKILL.md`, §0 : **c'est une liste de contrôle et
un second avis, pas une autorité.** En cas de contradiction avec un ADR de
`docs/DECISIONS.md`, l'ADR gagne. Ne pas lancer son générateur de design system sur
ce dépôt : Kesher a déjà le sien.

Interroger le corpus :

```bash
grep -i "focus" .claude/skills/ui-ux-pro-max/references/quick-reference.md
grep -i "dashboard" .claude/skills/ui-ux-pro-max/data/colors.csv
```

## Mise à jour

Re-télécharger les mêmes chemins depuis `main` et relire le diff — le dépôt amont
duplique ses fichiers pour sept assistants différents (`.claude`, `.codex`, `.gemini`,
`.trae`, `.continue`, `.shared`, `cli/assets`) ; c'est la variante `.claude` qui est
copiée ici.
