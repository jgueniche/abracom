---
title: Importer les familles depuis un fichier CSV
roles: [school_admin, super_admin]
routes: [/admin/import]
topic: manage
keywords: [import, CSV, familles, rentrée, modèle, colonnes, invitations, lots]
since: 5
reviewed: 2026-09-12
---

L'import se fait en deux temps, et le premier ne modifie rien.

1. **Vérifier le fichier.** Téléchargez le modèle, remplissez-le — une ligne par élève, jusqu'à deux parents —, puis déposez-le. L'écran affiche le nombre de lignes prêtes et **la liste des problèmes ligne par ligne**. Les classes inconnues pour l'année courante sont nommées : créez-les, ou corrigez les noms dans le fichier.
2. **Importer maintenant.** Les élèves, les inscriptions, les comptes parents et les liens parent-enfant sont créés. Le compte rendu chiffre chaque catégorie, en distinguant ce qui a été créé de ce qui existait déjà.

Colonnes obligatoires : `eleve_prenom`, `eleve_nom`, `classe`, `parent1_email`. Le fichier peut être séparé par `;`, `,` ou une tabulation, avec ou sans BOM ; les dates sont acceptées au format français comme au format ISO.

**L'import est idempotent** : rejouer le même fichier ne crée pas de doublons. En cas de doute, corrigez et réimportez.

**Aucun courriel ne part pendant l'import.** Les comptes sont créés silencieusement ; les invitations s'envoient ensuite depuis la page Utilisateurs, par lots de vingt. C'est ce qui permet de préparer une rentrée sans réveiller soixante familles.

L'import est réservé à la direction.
