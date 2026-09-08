# Feuille de route — Kesher

Une session ≈ 2–4 h de Claude Code, chacune **déployable, testée, committée**.
**MVP présentable à la direction = sessions 1–8.** Sessions 9–15 = V1 complète.

| #   | Livrable                                                                                                                     | Definition of done                                      | État                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| 1   | Bootstrap : Next 15, Tailwind, shadcn, Supabase local, CI lint/test, Vercel preview, CLAUDE.md, ROADMAP                      | `pnpm dev` OK, déploiement preview vert                 | ✅                                             |
| 2   | Identité visuelle : extraction palette logo, tokens, thème clair/sombre, page de style `/dev/ui`                             | Validation visuelle par le porteur                      | ✅ (validation visuelle du porteur en attente) |
| 3   | Schéma BDD complet + RLS + `can_access_*` + seed fictif (1 école, 6 classes PS→CE1, 12 enseignants, 60 familles) + tests RLS | Tests RLS verts pour les 6 rôles                        | ⬜                                             |
| 4   | Auth : magic link, invitations, onboarding parent/enseignant, CGU versionnées, profil, multi-rôle                            | Flux e2e « invitation → 1re connexion »                 | ⬜                                             |
| 5   | Admin : écoles, années, classes, affectations, import CSV, invitations en masse                                              | Directrice fictive importe 60 familles en < 2 min       | ⬜                                             |
| 6   | Annonces + accusés de lecture + documents + signatures                                                                       | Annonce ciblée classe avec relance des non-lecteurs     | ⬜                                             |
| 7   | Espace classe : fil, devoirs, cahier de vie (upload photos), mots individuels                                                | Enseignant publie, parent voit et coche « vu »          | ⬜                                             |
| 8   | Messagerie temps réel : DM, fils officiels, groupes de classe, modération, signalement                                       | 2 navigateurs, échange instantané, modération OK        | ⬜                                             |
| 9   | Agenda : hebcal, événements, RSVP, créneaux bénévolat, ICS                                                                   | Abonnement ICS visible dans Google Calendar             | ⬜                                             |
| 10  | Notifications : push, e-mail Resend, digest, préférences, **mode Shabbat**                                                   | Push reçu ; aucun envoi pendant fenêtre Shabbat simulée | ⬜                                             |
| 11  | Évaluations par compétences + livret PDF ; absences                                                                          | Livret PDF généré pour un élève fictif                  | ⬜                                             |
| 12  | Communauté : annuaire opt-in, petites annonces, anniversaires, RDV parents-prof, formulaires                                 | Réservation de créneau fonctionnelle                    | ⬜                                             |
| 13  | PWA, offline, recherche globale, accessibilité, performance (Lighthouse ≥ 90 mobile)                                         | Installable iOS/Android                                 | ⬜                                             |
| 14  | RGPD : export, suppression, docs/RGPD.md, audit log, 2FA admin, CSP                                                          | Checklist §9 cochée                                     | ⬜                                             |
| 15  | Guides utilisateurs (PDF + pages in-app), démo scénarisée, script de bascule staging→prod, promotion de niveau               | Démo de 15 min prête pour la direction                  | ⬜                                             |

## Session 1 — détail

- [x] Next.js 15.5 (App Router, TypeScript strict, `noUncheckedIndexedAccess`), pnpm 10, Node 22
- [x] Tailwind CSS v4 + shadcn/ui (preset Nova, base Radix, variables CSS) + lucide-react
- [x] next-intl sans préfixe d'URL (cookie `NEXT_LOCALE`, `fr` défaut, `en`) + test de parité des catalogues
- [x] next-themes (clair / sombre / système) + bascule de langue et de thème dans l'en-tête
- [x] Validation des variables d'environnement avec zod (`lib/env.ts`, `lib/env.server.ts`)
- [x] Clients Supabase navigateur / serveur / admin (`server-only`), résolus paresseusement
- [x] `supabase init` → `supabase/config.toml` (projet `kesher`, seed `supabase/seed/*.sql`)
- [x] Arborescence §11 (`app`, `components`, `lib`, `server`, `supabase`, `messages`, `docs`, `tests`)
- [x] En-têtes de sécurité de base (nosniff, frame DENY, referrer, permissions, HSTS), `robots` disallow
- [x] Pages `not-found` / `error` en français, sans stack trace
- [x] ESLint (Next + TS + Prettier) · Prettier (plugin Tailwind) · Husky (`pre-commit` lint-staged, `commit-msg` commitlint)
- [x] Vitest (3 fichiers, 9 tests) · Playwright (mobile + desktop, 8 tests, `CI=1` ⇒ `next start`)
- [x] CI GitHub Actions : quality (lint, types, format, unit) · build · e2e
- [x] `vercel.json` (framework nextjs, région `cdg1`, install/build pnpm)
- [x] Projet Vercel `abracom` importé depuis GitHub par le porteur (le connecteur de la session ne pouvait pas le créer) :
      production sur https://abracom.vercel.app (build vert, en-têtes de sécurité présents), previews par branche
      protégées par Vercel Authentication (visibles une fois connecté à Vercel). Variables d'environnement à
      ajouter dans Vercel : `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SITE_URL`, puis `NEXT_PUBLIC_SUPABASE_*` (session 3).
- [x] Branche `main` créée sur GitHub (commit `07ea95f`) pour servir de branche de production Vercel.
      **À faire par le porteur** : GitHub → Settings → General → Default branch → `main`.
- [ ] Projet Supabase cloud `kesher-staging` : à créer dans une **nouvelle organisation gratuite** dédiée
      (l'org ShiftX facturerait 10 $/mois), région `eu-west-3` (Paris), une fois l'organisation partagée
      avec le connecteur Claude. Puis renseigner `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      dans Vercel et `.env.local`.
- [ ] `supabase start` vérifié localement (Docker indisponible dans l'environnement de la session 1 ; à faire
      sur le poste du porteur).

## Session 2 — détail

- [x] Logo officiel téléchargé (`public/brand/logo-abravanel.png`, non altéré), palette extraite par
      `scripts/brand/extract-palette.mjs` et `extract-hue.mjs`
- [x] Logo polychrome (sarcelle, rouge brique, or doux, taupe) → une seule palette dérivée, sans variante à
      arbitrer : clair = papier + sarcelle, sombre = bleu nuit + sable (ADR-0010)
- [x] Tokens dans `app/globals.css` (shadcn + `surface`, `brand-*`, `shadow-soft`), rayon 0,875 rem ;
      contraste WCAG AA de chaque paire texte vérifié par `tests/unit/design-tokens.test.ts` (30 assertions)
      et `scripts/brand/check-contrast.ts`
- [x] Typographies : Inter (UI) + Fraunces (titres) via `next/font`, mono système (ADR-0011)
- [x] Page `/dev/ui` : tokens résolus dans le navigateur avec contraste calculé, typographie, boutons,
      formulaires, superpositions, aperçus de cartes métier, icônes ; visible en dev et en preview Vercel
- [x] Icônes PWA 192 / 512 + maskable, `apple-icon`, favicon PNG, `app/manifest.ts`
      (`scripts/brand/generate-icons.ts`)
- [x] `scripts/dev/screenshots.mjs` : captures mobile / desktop, clair / sombre, pour les PR
- [x] Tests : 44 unitaires, 12 e2e (dont manifest + icônes + `/dev/ui`)
- [ ] **Validation visuelle par le porteur** : ouvrir `/dev/ui` sur la preview Vercel de la branche ou
      regarder les captures envoyées dans la session ; ajustements de teinte possibles sans toucher aux composants

## Questions ouvertes (§15 du brief)

Bloquantes pour la session 2 :

1. **Palette** : le logo est-il monochrome ? Si oui, choix entre bleu profond / or doux et bleu nuit / sable.
2. **Typographie des titres** : Fraunces ou Newsreader (Inter pour l'UI dans les deux cas).

Non bloquantes avant la session 3 (à trancher pour les sessions 3–10) :

3. Nom définitif et domaine (`kesher-abravanel.fr` ? sous-domaine de institutions-abravanel.fr ?).
4. Educartable : simple lien profond (aucune API publique connue) — hypothèse retenue.
5. Évaluations : compétences uniquement en maternelle ; notes chiffrées optionnelles en élémentaire ?
6. Groupes de classe : enseignant présent par défaut ou « parents seuls » avec parent délégué ?
7. Petites annonces / marketplace : autorisées par la direction ?
8. SMS (Twilio) pour urgences : budget accepté ?
9. Fournisseur e-mail : Resend (UE) ou domaine e-mail de l'école (SPF/DKIM) ?
10. Levallois : échéance d'activation ?
11. **Supabase cloud** : `kesher-staging` dans une organisation gratuite dédiée, région `eu-west-3` (décidé le 2026-09-08, voir Session 1 — détail).
