# Démo scénarisée (15 minutes)

Données 100 % fictives (`supabase/seed/seed.sql`, comptes `*@demo.local`). Connexion par le bouton
« Se connecter avec un mot de passe » : `demo-password` sur la stack locale, mot de passe propre au
staging (attribué avec `scripts/ops/create-account.sql`, jamais committé — ADR-0028). Remettre la base à
zéro avant chaque démo : `pnpm db:reset` (Docker) ou `pnpm db:test` (PostgreSQL local).

| Compte                  | Rôle                             | À montrer                                       |
| ----------------------- | -------------------------------- | ----------------------------------------------- |
| `admin@demo.local`      | Direction (`school_admin`)       | Administration, annonces, modération, promotion |
| `staff@demo.local`      | Secrétariat (`staff`)            | Familles, import, absences (pas d'évaluations)  |
| `teacher-ps@demo.local` | Enseignante PS Tournesols        | Publication, évaluations, RDV                   |
| `parent-1@demo.local`   | Parent de Maya (PS) et Noam (CP) | Parcours famille complet                        |
| `parent-en@demo.local`  | Parent anglophone                | Interface en anglais                            |

## Déroulé

1. **Accueil parent** (`parent-1`, téléphone) — 2 min : annonce à confirmer → « J'ai lu » ; enfants ;
   prochains événements. Installer l'application (bannière).
2. **Classe de Maya** — 3 min : fil, devoir à cocher « vu », cahier de vie (photos floutées → droit à
   l'image), mot de l'enseignante avec accusé de lecture, déclarer une absence avec justificatif.
3. **Messagerie** — 2 min : deux navigateurs (`parent-1` et `teacher-ps`), échange instantané dans le
   groupe PS, réaction, signalement d'un message → file de modération côté direction.
4. **Agenda** — 2 min : fêtes juives et horaires de Chabbat, réunion de rentrée avec RSVP et jauge (liste
   d'attente), bénévolat « apporter la hallah », abonnement au calendrier.
5. **Enseignante** (`teacher-ps`) — 2 min : matrice de compétences, appréciation, « Publier aux familles »
   → notification côté parent, livret PDF.
6. **Direction** (`admin`) — 3 min : validation en deux étapes, annonce ciblée avec relance des
   non-lecteurs, signatures manquantes du droit à l'image, import CSV (modèle), journal d'audit,
   promotion de niveau (assistant) en fin d'année.
7. **Communauté et données** — 1 min : annuaire opt-in, petite annonce relue par l'école, formulaire de
   rentrée avec export CSV ; export / suppression de compte, mode Chabbat des notifications.

## Points à souligner

- Hébergement UE, RLS sur toutes les tables (264 assertions pgTAP, dont l'isolation multi-établissement), aucun traceur.
- Familles séparées : droits indépendants par responsable, restriction judiciaire.
- Tout est notifié mais rien ne part pendant Chabbat et les fêtes.
