# Feuille de route — Kesher

Une session ≈ 2–4 h de Claude Code, chacune **déployable, testée, committée**.
**MVP présentable à la direction = sessions 1–8.** Sessions 9–15 = V1 complète.

| #   | Livrable                                                                                                                     | Definition of done                                      | État                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Bootstrap : Next 15, Tailwind, shadcn, Supabase local, CI lint/test, Vercel preview, CLAUDE.md, ROADMAP                      | `pnpm dev` OK, déploiement preview vert                 | ✅                                                                                    |
| 2   | Identité visuelle : extraction palette logo, tokens, thème clair/sombre, page de style `/dev/ui`                             | Validation visuelle par le porteur                      | ✅ (validation visuelle du porteur en attente)                                        |
| 3   | Schéma BDD complet + RLS + `can_access_*` + seed fictif (1 école, 6 classes PS→CE1, 12 enseignants, 60 familles) + tests RLS | Tests RLS verts pour les 6 rôles                        | ✅ (validé sur PostgreSQL 16 local + CI ; à rejouer sur Supabase dès que disponible)  |
| 4   | Auth : magic link, invitations, onboarding parent/enseignant, CGU versionnées, profil, multi-rôle                            | Flux e2e « invitation → 1re connexion »                 | 🟡 code complet, e2e « invitation → 1re connexion » à exécuter sur une stack Supabase |
| 5   | Admin : écoles, années, classes, affectations, import CSV, invitations en masse                                              | Directrice fictive importe 60 familles en < 2 min       | 🟡 code complet, chronométrage de l'import à réaliser sur une stack Supabase          |
| 6   | Annonces + accusés de lecture + documents + signatures                                                                       | Annonce ciblée classe avec relance des non-lecteurs     | ⬜                                                                                    |
| 7   | Espace classe : fil, devoirs, cahier de vie (upload photos), mots individuels                                                | Enseignant publie, parent voit et coche « vu »          | ⬜                                                                                    |
| 8   | Messagerie temps réel : DM, fils officiels, groupes de classe, modération, signalement                                       | 2 navigateurs, échange instantané, modération OK        | ⬜                                                                                    |
| 9   | Agenda : hebcal, événements, RSVP, créneaux bénévolat, ICS                                                                   | Abonnement ICS visible dans Google Calendar             | ⬜                                                                                    |
| 10  | Notifications : push, e-mail Resend, digest, préférences, **mode Shabbat**                                                   | Push reçu ; aucun envoi pendant fenêtre Shabbat simulée | ⬜                                                                                    |
| 11  | Évaluations par compétences + livret PDF ; absences                                                                          | Livret PDF généré pour un élève fictif                  | ⬜                                                                                    |
| 12  | Communauté : annuaire opt-in, petites annonces, anniversaires, RDV parents-prof, formulaires                                 | Réservation de créneau fonctionnelle                    | ⬜                                                                                    |
| 13  | PWA, offline, recherche globale, accessibilité, performance (Lighthouse ≥ 90 mobile)                                         | Installable iOS/Android                                 | ⬜                                                                                    |
| 14  | RGPD : export, suppression, docs/RGPD.md, audit log, 2FA admin, CSP                                                          | Checklist §9 cochée                                     | ⬜                                                                                    |
| 15  | Guides utilisateurs (PDF + pages in-app), démo scénarisée, script de bascule staging→prod, promotion de niveau               | Démo de 15 min prête pour la direction                  | ⬜                                                                                    |

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

## Session 3 — détail

- [x] 10 migrations SQL versionnées (`supabase/migrations/2026090817*`) : extensions + recherche plein texte
      française sans accents, 23 enums, 47 tables avec `school_id`, index sur toutes les FK, `(class_id, published_at desc)`,
      `(thread_id, created_at desc)`, `tsvector` générés sur annonces / posts / messages / petites annonces,
      `deleted_at` (soft delete) là où un parent peut demander l'effacement
- [x] Fonctions d'accès `security definer` : `can_access_class`, `can_access_student`, `can_view_student_grades`,
      `can_view_profile`, `matches_audience`, `is_school_staff` / `is_school_admin` / `is_super_admin`,
      `teaches_student`, `is_thread_member`… réutilisées par toutes les politiques
- [x] RLS activée sur les 47 tables + `storage.objects` (132 politiques) ; `anon` ne voit rien ; rôle
      `guardian` en lecture seule (ni évaluations, ni messagerie) ; `staff` sans accès aux évaluations ;
      restriction judiciaire (`student_guardians.access_blocked`) masquant totalement l'enfant
- [x] Déclencheurs : création automatique du profil, `updated_at`, `last_message_at`, **blocage du tag d'un
      élève sans droit à l'image signé**, une seule année courante par école
- [x] Buckets privés `avatars`, `class-media`, `documents`, `attachments`, `justifications` avec politiques
      par convention de chemin
- [x] Seed fictif (`supabase/seed/seed.sql`) : 1 école, année 2026-2027, 6 classes, 12 enseignants (dont
      anglais et kodesh sur toutes les classes), 60 familles / 137 comptes / 66 élèves, 5 familles séparées,
      3 anglophones, 2 guardians, 1 restriction judiciaire, 72 posts sur 3 semaines, 10 annonces, 8 événements
      (Roch Hachana, Souccot, Hanouka, 2 sorties avec autorisations, réunion de rentrée avec RSVP), grille de
      compétences PS/MS/GS (63 compétences, 693 évaluations période 1), fils de classe + DM, petites annonces
- [x] Tests pgTAP (`supabase/tests/rls`) : 53 assertions vertes pour les 6 rôles + anonyme + cas limites
- [x] Exécution sans Docker : `supabase/tests/local/auth-shim.sql` + `scripts/db/test-local.sh` (ADR-0013) ;
      job CI `database` (PostgreSQL 16 + pgTAP sur le runner)
- [x] Types TypeScript générés (`lib/supabase/database.types.ts`, 2 548 lignes) via `pnpm db:types:local`
      (postgres-meta, sans Docker) ; clients Supabase typés
- [ ] Rejouer `supabase db reset` + `supabase test db` sur la stack Supabase (poste avec Docker ou projet
      cloud `kesher-staging`) pour confirmer l'équivalence avec le shim

## Session 4 — détail

- [x] Middleware de session (`middleware.ts` + `lib/supabase/middleware.ts`) : rafraîchissement des cookies,
      redirection vers `/connexion?next=…` hors session, passage transparent quand Supabase n'est pas configuré
- [x] Connexion par **magic link** sans inscription libre (`signInWithOtp` avec `shouldCreateUser: false`,
      `enable_signup = false` dans `config.toml`), réponse identique pour les adresses inconnues
- [x] Routes `/auth/callback` (PKCE) et `/auth/confirm` (token hash) ; la langue du profil est copiée dans le
      cookie de locale à la connexion
- [x] Invitations : e-mails Supabase en français (`supabase/templates/invite.html`, `magic_link.html`) ;
      création des comptes par `auth.admin.inviteUserByEmail` (import CSV en session 5)
- [x] Onboarding `/bienvenue` : prénom, nom, langue, acceptation horodatée des CGU / charte / politique de
      confidentialité versionnées (`legal_documents` + `legal_acceptances`), activation des memberships
      invitées via `activate_my_memberships()` (security definer, testé en pgTAP)
- [x] `lib/auth` (utilisateur courant en cache par requête, statut légal, garde d'onboarding) et
      `lib/permissions` (fonctions pures testées : rôles par école, super admin, guardians en lecture seule,
      perspectives)
- [x] Multi-rôle : perspectives Direction / Enseignant·e / Parent, sélecteur dans l'en-tête, cookie
      `kesher-perspective`
- [x] Coquille connectée : en-tête (école, perspective, langue, thème, avatar), navigation 5 onglets mobile +
      barre desktop, pages Accueil (par perspective : enfants + annonces à confirmer / mes classes / tableau de
      bord), Ma famille, Mon profil (+ textes acceptés), Plus (Educartable, préférences, déconnexion),
      emplacements Classe(s) / Messages / Agenda / Annonces
- [x] Clés étrangères vers `profiles` pour les jointures PostgREST (auteurs, membres), types régénérés
- [x] Un guardian ne voit ses enfants qu'avec une membership **active** (correctif RLS, testé)
- [x] Tests : 56 unitaires, 14 e2e (page de connexion, i18n, thème, en-têtes), 56 assertions pgTAP
- [ ] **E2E « invitation → 1re connexion »** (`tests/e2e/auth-invitation.spec.ts`, activé par `SUPABASE_E2E=1`
      avec la boîte Mailpit de la stack locale) : à exécuter dès qu'une stack Supabase est disponible
- [ ] OTP SMS (Twilio) : différé (question §15 n° 8, budget)

## Session 5 — détail

- [x] Espace `/admin` (secrétariat + direction ; certaines actions réservées à la direction) : Familles,
      Classes, Utilisateurs, Années, Import CSV, Journal
- [x] Années scolaires : création, année courante unique via `set_current_school_year()` (security definer)
- [x] Classes : création / modification / archivage, affectation des enseignants (principal, assistant,
      spécialiste + matière), effectif, liste des élèves
- [x] Élèves et familles : recherche, fiche élève (état civil, allergies / PAI, statut), inscription et
      changement de classe (clôture automatique de l'ancienne inscription), responsables avec droits
      indépendants (évaluations, messagerie, notifications) et **restriction judiciaire** motivée et journalisée,
      rattachement d'un responsable (compte existant ou créé)
- [x] Utilisateurs : invitation de l'équipe (direction, secrétariat, enseignant), renvoi de lien de connexion
      (« réinitialisation d'accès »), suspension / réactivation / retrait, parents en attente d'invitation
- [x] **Import CSV** (`lib/import`, 11 tests unitaires) : parseur RFC 4180 (BOM, `;` `,` tabulation, guillemets),
      alias de colonnes français, dates FR/ISO, téléphones E.164, liens de parenté ; aperçu avec problèmes par
      ligne et contrôle des classes ; import idempotent (familles, élèves, inscriptions, comptes créés sans
      e-mail via `auth.admin.createUser`, memberships `invited`, liens parent-enfant) ; modèle téléchargeable
- [x] **Invitations en masse** par lots de 20 (`sendPendingInvitations`) pour rester sous les limites de
      durée des fonctions serverless ; chaque lot horodate `invited_at`
- [x] Journal d'audit alimenté par toutes les actions d'administration (`server/audit.ts`)
- [x] Fonctions SQL : `find_user_id_by_email` (service role uniquement), `set_current_school_year`
- [ ] Chronométrer « 60 familles en < 2 min » sur une stack Supabase (import ≈ 130 créations de comptes +
      3 lots d'invitations)
- [ ] Promotion de niveau / clôture d'année (session 15)

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
