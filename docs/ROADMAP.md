# Feuille de route — Kesher

Une session ≈ 2–4 h de Claude Code, chacune **déployable, testée, committée**.
**MVP présentable à la direction = sessions 1–8.** Sessions 9–15 = V1 complète. État au 2026-09-08 : les quinze
sessions sont codées ; la validation sur une stack Supabase cloud reste à faire (voir « Bilan V1 »).

| #   | Livrable                                                                                                                     | Definition of done                                      | État                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Bootstrap : Next 15, Tailwind, shadcn, Supabase local, CI lint/test, Vercel preview, CLAUDE.md, ROADMAP                      | `pnpm dev` OK, déploiement preview vert                 | ✅                                                                                                  |
| 2   | Identité visuelle : extraction palette logo, tokens, thème clair/sombre, page de style `/dev/ui`                             | Validation visuelle par le porteur                      | ✅ (validation visuelle du porteur en attente)                                                      |
| 3   | Schéma BDD complet + RLS + `can_access_*` + seed fictif (1 école, 6 classes PS→CE1, 12 enseignants, 60 familles) + tests RLS | Tests RLS verts pour les 6 rôles                        | ✅ (validé sur PostgreSQL 16 local + CI ; à rejouer sur Supabase dès que disponible)                |
| 4   | Auth : magic link, invitations, onboarding parent/enseignant, CGU versionnées, profil, multi-rôle                            | Flux e2e « invitation → 1re connexion »                 | 🟡 code complet, e2e « invitation → 1re connexion » à exécuter sur une stack Supabase               |
| 5   | Admin : écoles, années, classes, affectations, import CSV, invitations en masse                                              | Directrice fictive importe 60 familles en < 2 min       | 🟡 code complet, chronométrage de l'import à réaliser sur une stack Supabase                        |
| 6   | Annonces + accusés de lecture + documents + signatures                                                                       | Annonce ciblée classe avec relance des non-lecteurs     | 🟡 code complet, parcours à valider sur une stack Supabase (upload Storage, e-mails)                |
| 7   | Espace classe : fil, devoirs, cahier de vie (upload photos), mots individuels                                                | Enseignant publie, parent voit et coche « vu »          | 🟡 code complet, upload photos à valider sur une stack Supabase                                     |
| 8   | Messagerie temps réel : DM, fils officiels, groupes de classe, modération, signalement                                       | 2 navigateurs, échange instantané, modération OK        | 🟡 code complet, échange à 2 navigateurs (Realtime) à valider sur une stack Supabase                |
| 9   | Agenda : hebcal, événements, RSVP, créneaux bénévolat, ICS                                                                   | Abonnement ICS visible dans Google Calendar             | 🟡 code complet, abonnement ICS à vérifier dans Google Agenda sur une stack Supabase                |
| 10  | Notifications : push, e-mail Resend, digest, préférences, **mode Shabbat**                                                   | Push reçu ; aucun envoi pendant fenêtre Shabbat simulée | 🟡 code complet ; push réel et e-mails à valider avec clés VAPID + Resend sur une stack Supabase    |
| 11  | Évaluations par compétences + livret PDF ; absences                                                                          | Livret PDF généré pour un élève fictif                  | 🟡 code complet ; livret PDF généré en test unitaire, rendu réel à valider sur une stack Supabase   |
| 12  | Communauté : annuaire opt-in, petites annonces, anniversaires, RDV parents-prof, formulaires                                 | Réservation de créneau fonctionnelle                    | 🟡 code complet, réservation de créneau testée en pgTAP ; parcours à valider sur une stack Supabase |
| 13  | PWA, offline, recherche globale, accessibilité, performance (Lighthouse ≥ 90 mobile)                                         | Installable iOS/Android                                 | 🟡 code complet ; installation à valider sur iOS / Android, Lighthouse mesuré sur le déploiement    |
| 14  | RGPD : export, suppression, docs/RGPD.md, audit log, 2FA admin, CSP                                                          | Checklist §9 cochée                                     | 🟡 code complet ; 2FA et suppression de compte à valider sur une stack Supabase                     |
| 15  | Guides utilisateurs (PDF + pages in-app), démo scénarisée, script de bascule staging→prod, promotion de niveau               | Démo de 15 min prête pour la direction                  | 🟡 code et documents complets ; démo à jouer sur une stack Supabase avant la présentation           |

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
- [x] Connexion par mot de passe en complément du lien magique (comptes de démonstration, premier
      administrateur ; `scripts/ops/create-account.sql`, ADR-0028)
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
- [x] Promotion de niveau / clôture d'année : assistant `/admin/annees/promotion` (session 15)

## Session 6 — détail

- [x] Annonces côté parents / enseignants : liste (épinglées, non lues, confirmation demandée), détail Markdown
      assaini, accusé de lecture automatique à l'affichage + bouton « J'ai lu », pièces jointes en URL signées
      10 min, document à signer lié, version anglaise affichée aux familles anglophones
- [x] Éditeur Markdown avec barre d'outils et aperçu (tiptap différé, ADR-0017), modèles (circulaire, rappel,
      jour férié / fête, sortie scolaire), traduction anglaise manuelle, ciblage école / niveaux / classes /
      personnes (`AudiencePicker`), planification, épinglage, expiration, brouillon / publication immédiate
- [x] Tableau des accusés de lecture par annonce : destinataires calculés en SQL (`announcement_recipients`),
      lus / confirmés, liste des non-lecteurs, **relance en un clic** (`remind_announcement` → notifications
      in-app, journalisée), **export CSV**
- [x] Pièces jointes : upload dans le bucket privé `attachments` (25 Mo, types contrôlés), suppression
- [x] Documents : bibliothèque par dossier, audience, versions, téléchargement via redirection signée
      (`/documents/[id]/fichier`), **signature électronique** (case + horodatage + IP + user agent) par famille ou
      par enfant ; signer le droit à l'image renseigne `students.image_rights_signed_at` (trigger)
- [x] Administration des documents : dépôt (fichier + métadonnées + nouveau dossier), nature (`purpose`),
      publication, suppression, **tableau des signatures manquantes** (`document_missing_signatures`)
- [x] Notifications in-app : cloche avec compteur dans l'en-tête, page `/notifications`, tout marquer lu
- [x] Migration `20260908171400`, pgTAP : 63 assertions (destinataires, relance, signatures, trigger droit à l'image)
- [ ] Valider sur une stack Supabase : upload / URL signées Storage, e-mails de relance (session 10),
      captures pour la direction
- [ ] Traduction automatique via LLM (bouton désactivé par défaut) : non implémentée, à décider (§15)

## Session 7 — détail

- [x] `/classes` : classes des enfants (parents), classes enseignées (enseignants), toutes les classes (direction) ;
      accès contrôlé par `requireClassAccess` (enseignant de la classe, personnel, responsable d'un élève inscrit)
- [x] Fil de classe typé (`homework` / `journal` / `info` / `reminder`), Markdown assaini, brouillons et
      publications, visibilité « équipe uniquement », suppression (soft delete, journalisée)
- [x] Devoirs / « à préparer » : date, matière, **case « vu » par enfant** côté parent (`homework_completions`),
      compteur de familles côté enseignant, vue hebdomadaire (en retard / cette semaine / semaine prochaine / plus tard)
- [x] Cahier de vie : upload multi-photos, **normalisation serveur** (rotation, 1600 px max, WebP, EXIF supprimé,
      blurhash), bucket privé `class-media`, URL signées par lot (10 min), galerie par mois, **tag des élèves
      limité aux droits à l'image signés** (contrôle UI + trigger SQL), suppression photo
- [x] Mots individuels : rédaction par l'enseignant (encouragement / point d'attention / information,
      visibilité parents ou équipe), lecture par les parents avec **accusé de lecture**, compteur côté enseignant
- [x] Absences / retards : déclaration par le parent (dates, motif, justificatif dans le bucket privé
      `justifications`), liste par classe pour l'équipe, validation justifiée / non justifiée par le secrétariat
      (journalisée) ; les guardians en lecture seule ne peuvent pas déclarer (migration `20260908171500`)
- [x] Vue hebdo enseignant sur l'accueil : publications de la semaine et devoirs à venir par classe
- [x] `Ma famille` : raccourcis par enfant vers fil, devoirs, cahier, mots, absences
- [x] pgTAP : 71 assertions (vu, absences, mots, interdictions parent / guardian)
- [ ] Valider sur une stack Supabase : upload et affichage des photos (Storage), captures mobile
- [ ] Pointage du matin (optionnel) et compression côté client avant envoi : plus tard

## Session 8 — détail

- [x] Migration `20260908171600_messaging` : bucket privé `messages` (`{school_id}/{thread_id}/{fichier}`),
      publication Realtime (`messages`, `message_reactions`, `thread_members`), `can_direct_message`
      (parent → enseignant de la classe d'un enfant ou direction ; jamais parent ↔ parent sauf module
      `messaging.parentToParent` ; guardians exclus), `open_dm` (réutilise le DM existant), `ensure_class_threads`
      (fil officiel + groupe de parents, idempotent), `my_threads` (non-lus, aperçu, interlocuteur), `dm_contacts`
- [x] `/messages` : liste des fils (actifs / archivés, badges non-lus, mode silencieux), `/messages/nouveau`
      (contacts autorisés), `/messages/[threadId]` : **temps réel** (`postgres_changes` filtré par fil),
      séparateurs par jour, mentions `@`, réponses en fil, réactions (5 emojis), pièces jointes (3 max,
      10 Mo, image / PDF, URL signées via `/api/storage/messages`), recherche plein texte (`websearch`,
      dictionnaire `french_unaccent`), bandeau des horaires de réponse de l'école
- [x] Modération : signalement avec motif, suppression par l'auteur, masquage par un modérateur (journalisé,
      clôt les signalements), verrouillage et archivage d'un fil (journalisés), file `/admin/signalements`
- [x] Espace classe : bouton « Discussion » (crée / ouvre les fils de classe pour l'équipe, lien parents)
- [x] Unitaires : segmentation des mentions, clé de jour par fuseau, parsing des pièces jointes ;
      pgTAP : 81 assertions (membres, modérateurs, DM refusés, guardians exclus)
- [ ] Valider sur une stack Supabase : échange instantané entre 2 navigateurs, uploads, captures mobile
- [ ] Notifications push / e-mail des nouveaux messages : session 10 ; indicateur « en train d'écrire » : plus tard

## Session 9 — détail

- [x] `lib/hebcal` (`@hebcal/core` + `@hebcal/locales`, calcul local, cache par année) : fêtes catégorisées
      (majeure / mineure / moderne / jeûne / veille / h'ol hamoed / **lendemain de fête** / Roch H'odech),
      allumage des bougies et havdalah aux coordonnées de l'école, parachah de la semaine, date hébraïque,
      **fenêtres Chabbat / yom tov** (`quietWindows`, `isQuietTime`) prêtes pour le mode Chabbat de la session 10
- [x] `lib/calendar` : jours fériés français (calcul de Pâques), conversions fuseau (`zonedToUtc`,
      `utcToZonedNaive`), écriture ICS sans dépendance (pliage à 75 octets, UTC, journées entières)
- [x] Vacances scolaires zone C 2026-2027 en seed (source data.gouv.fr « Le calendrier scolaire »), en
      événements `holiday` toute la journée modifiables par la direction
- [x] `/agenda` : vue par mois (navigation, filtres tout / événements / fêtes), date hébraïque et parachah du
      jour, badges fêtes / jours fériés / Chabbat, horaires d'allumage, événements multi-jours
- [x] `/agenda/[id]` : description Markdown, lieu, participation, **RSVP oui / non / peut-être +
      accompagnants** (fonction SQL `rsvp_event` : date limite, jauge, **liste d'attente promue
      automatiquement** avec notification), créneaux de bénévolat (capacité en trigger, guardians exclus),
      liste des réponses et des sans-réponse pour l'équipe
- [x] `/agenda/nouveau` et `/agenda/[id]/modifier` : modèles prédéfinis (réunion de rentrée, fête de classe,
      kabbalat Chabbat, Hanoucca, Pourim, Yom Ha'atsmaout, Lag Baomer, kermesse, sortie, photo de classe),
      audience école / niveau / classe (enseignants : leurs classes uniquement), créneaux, suppression,
      notification `event.new` à la publication ; `/admin/evenements` pour la direction
- [x] **Flux ICS privé** par utilisateur (`calendar_feeds`, jeton 48 hex, régénération, fêtes juives et
      jours fériés optionnels) servi par `/api/calendar/[token]` ; carte d'abonnement (copie, Google Agenda,
      Apple / Outlook)
- [x] Rappels J-7 / J-1 (`queue_event_reminders`, idempotent, service role) à planifier en pg_cron (session 10)
- [x] Widget « Prochains événements » sur les accueils parent et enseignant ; notifications `event.*`
- [x] Tests : 19 unitaires (hebcal, fériés, ICS, dates), 42 pgTAP (`003_agenda.sql`), e2e agenda
- [ ] Vérifier sur une stack Supabase : abonnement ICS visible dans Google Agenda (rafraîchissement ~24 h
      côté Google), notifications de liste d'attente, captures mobile
- [ ] Événements personnels (par enfant) et export CSV des réponses : plus tard

## Session 10 — détail

- [x] Migration `20260908171800_notifications` : table `notification_deliveries` (push / e-mail planifiés
      par trigger selon `effective_preference()`), fan-out SQL idempotent du contenu publié
      (`notify_due_content()` : annonces, documents, publications de classe hors « équipe »), triggers mots
      individuels, messages (membres non silencieux, jamais l'auteur), signalements → équipe, absences
      (déclaration → équipe, validation → parent), `claim_notification_deliveries()` (verrouillage
      `skip locked`, tentatives) et `digest_candidates()` réservés au service role
- [x] Préférences par type (push / e-mail / résumé) sur huit groupes, heures calmes, **mode Chabbat / fêtes
      activé par défaut** ; les messages ne sont jamais e-mailés un par un (push + résumé)
- [x] Worker `POST|GET /api/jobs/notifications?task=dispatch|digest|reminders` (bearer `CRON_SECRET`) :
      Web Push (VAPID, suppression des abonnements expirés), e-mails Resend (API REST, modèles FR / EN
      sans image ni traceur), **report automatique pendant Chabbat / yom tov** (`lib/hebcal.quietWindows`) et
      les heures calmes, digest 18 h regroupant le non-lu, rappels J-7 / J-1
- [x] Planification : Vercel Cron (digest + rappels quotidiens, plan Hobby) et `supabase/jobs/cron.sql`
      (pg_cron + pg_net + Vault, envoi toutes les cinq minutes) — voir `supabase/jobs/README.md`
- [x] Appareil : service worker `public/sw.js`, activation / test des notifications push depuis
      `/notifications/preferences`, page de préférences, rendu partagé des notifications (`lib/notifications/render`)
- [x] Fan-out immédiat à la publication (annonces, documents, publications de classe) ; seed marqué comme
      déjà notifié pour ne pas inonder la démo
- [x] Tests : 20 unitaires (mode Chabbat simulé, heures calmes, rendu, groupes), 36 pgTAP (`004_notifications.sql`)
- [ ] Valider avec de vraies clés : push reçu sur iOS (PWA installée) et Android, e-mail Resend depuis un
      domaine vérifié, exécution du cron toutes les cinq minutes
- [ ] SMS d'urgence (Twilio, question ouverte 8) et préférences d'e-mail par enfant : plus tard

## Session 11 — détail

- [x] Migration `20260908171900_assessments` : appréciations de période (`assessment_remarks`, visibles par
      les familles uniquement une fois la période publiée), suppression d'une case par tout enseignant de la
      classe, `publish_assessments(class, period)` (idempotent, journalisé, notifie les responsables
      autorisés à voir les évaluations), groupe de notification « vie de classe »
- [x] `/classes/[classId]/evaluations` enseignant / direction : sélecteur de période, **matrice élèves ×
      compétences** (menus NA / EC / A / M teintés, première colonne fixe, défilement horizontal), notes /20
      optionnelles pour l'élémentaire si le module `assessments.scores` est activé, appréciations par élève,
      enregistrement global (upsert + suppression des cases vidées), **publication différée** avec compteur des
      évaluations en attente, liens livret PDF par élève
- [x] Même page côté familles : compétences publiées de l'enfant par domaine avec badges, commentaires,
      appréciation, bouton livret ; le secrétariat et les guardians en lecture seule sont exclus (RLS + UI)
- [x] **Livret PDF** `/api/livret/[studentId]?period=` : `@react-pdf/renderer` côté serveur (en-tête école /
      élève / classe / enseignant·e, domaines et compétences avec échelle graphique, appréciation, absences et
      retards de la période, mention « brouillon » pour l'équipe), RLS = ce que l'appelant a le droit de voir
- [x] Onglet « Évaluations » dans la classe et sur la page famille ; notification `assessment.published`
- [x] Middleware : les routes authentifiées par jeton (`/api/calendar`, `/api/jobs`) et le service worker sont
      publics (correction de la CI e2e de la session 9)
- [x] Tests : PDF généré pour un élève fictif (2 unitaires, environnement Node), 17 pgTAP (`005_assessments.sql`)
- [ ] Valider sur une stack Supabase : rendu du livret avec les données réelles, temps de génération
- [ ] Commentaire par compétence dans la matrice et import de grilles de compétences : plus tard

## Session 12 — détail

- [x] Migration `20260908172000_community` : annuaire opt-in par classe (`class_directory`, champs exposés
      selon les choix de chaque famille, accès limité aux classes de l'appelant), anniversaires opt-in
      (`class_birthdays`, rappel J-3 aux familles de la classe via `queue_birthday_reminders`), petites annonces
      avec **modération a priori imposée par trigger** (statut `pending` forcé, auteur limité au retrait,
      republication après modification, expiration 30 jours), notifications équipe / auteur, **RDV parents-
      enseignant** (`book_appointment` : un seul rendez-vous à venir par famille et par classe, créneau libre,
      enfant de la classe ; `cancel_appointment` ; `class_appointments` avec noms pour l'équipe seulement),
      formulaires notifiés à leur audience (`notify_due_forms`), contact d'annonce selon l'annuaire
- [x] `/communaute` : hub (annonces, annuaire, formulaires, RDV par classe, anniversaires à venir)
- [x] `/communaute/annonces` : catégories (covoiturage, garde partagée, objets trouvés, don / prêt / vente,
      recommandation), publication, mes annonces avec statut, détail avec coordonnées opt-in, retrait ;
      `/admin/communaute` : file de modération (publier / refuser / archiver, journalisé)
- [x] `/communaute/annuaire` : réglages « ce que je partage » (téléphone, e-mail, prénoms des enfants, adresse,
      anniversaires) et annuaire par classe (familles, enseignants, direction)
- [x] `/classes/[classId]/rdv` : l'enseignant·e ouvre des créneaux (date, plage, durée, lieu), les familles
      réservent pour un enfant, annulation des deux côtés, autres réservations anonymes pour les familles
- [x] Formulaires : `/communaute/formulaires` (statut, répondu / à remplir, une réponse par enfant) et saisie
      typée (texte, texte long, choix unique / multiple, oui / non, nombre, date) ; `/admin/formulaires` :
      constructeur de champs, audience, ouverture / clôture, réponses en tableau et **export CSV**
- [x] Seed : fiche de rentrée et sondage garderie avec réponses, créneaux de RDV du PS, anniversaires partagés
- [x] Tests : 24 pgTAP (`006_community.sql`)
- [ ] Valider sur une stack Supabase : parcours complet annonce → modération → contact, rappel d'anniversaire
- [ ] Coordination gâteau via `event_slots` (bouton « organiser un goûter » pré-rempli) et messagerie
      parent ↔ parent sur réglage admin : plus tard

## Session 13 — détail

- [x] **PWA** : service worker `public/sw.js` (page hors ligne et icônes pré-cachées, assets `_next/static`
      en cache-first, pages toujours réseau — aucune donnée privée stockée —, gestion des push), page
      `/hors-ligne`, enregistrement en production uniquement, bannière d'installation (invite native
      Android / bureau, consignes iOS « Partager → Sur l'écran d'accueil », mémorisée si refusée)
- [x] **Recherche globale** `/recherche` : fonction SQL `global_search` (invoker : la RLS s'applique) sur
      annonces, publications de classe, messages, petites annonces, événements et documents, dictionnaire
      français sans accents, extraits surlignés ; champ de recherche dans l'en-tête (formulaire natif)
- [x] **Accessibilité** : lien d'évitement, repère `main` focalisable, libellés et `aria-current` vérifiés,
      test e2e axe (WCAG 2.1 AA, aucune violation sérieuse) sur les pages publiques
- [x] **Performance** : script `pnpm perf` (Lighthouse mobile, seuil 90 avec `STRICT=1`), compression des
      photos côté client avant envoi (`lib/media-client`, canvas 1600 px, JPEG 0,82, orientation EXIF
      respectée) en complément de la normalisation serveur
- [x] Tests : pgTAP `007_search.sql` (5), e2e axe (2), routes publiques ; Lighthouse mobile local sur `/connexion` :
      performance 95, accessibilité 100, bonnes pratiques 100 (SEO 54, attendu : application privée en `noindex`)
- [ ] Valider sur le déploiement : installation iOS / Android, notification push après installation,
      score Lighthouse ≥ 90 sur les pages connectées (mesure sur Vercel avec `pnpm perf <url>`)
- [ ] Mode hors ligne en lecture (dernières annonces mises en cache) : plus tard, si besoin exprimé

## Session 14 — détail

- [x] `docs/RGPD.md` : registre des traitements, sous-traitants UE, durées de conservation, exercice des
      droits, mesures de sécurité, procédure de violation
- [x] Migration `20260908172200_rgpd` : `export_my_data()` (JSON complet sous RLS), `delete_my_account()`
      (anonymisation immédiate, liens et abonnements supprimés, dernier administrateur protégé, journalisé),
      `purge_expired_data()` (messages 2 ans, notifications 6 mois, livraisons 30 jours, journal 3 ans,
      annonces retirées 90 jours, photos des élèves partis, anonymisation des élèves un an après leur départ)
      exécutée chaque nuit (tâche `reminders` du worker + `cron.sql`)
- [x] `/profil/donnees` : export (`/api/export/donnees`) et suppression de compte avec mot de confirmation
- [x] **2FA (TOTP)** : `/profil/securite` (inscription par QR code, confirmation, désactivation avec code),
      `/verification` à la connexion pour les personnes inscrites, **obligatoire pour la direction**
      (redirection vers l'inscription avant l'administration, actions refusées sans AAL2), journalisé ;
      `config.toml` : TOTP activé
- [x] **CSP stricte à nonce** générée par le middleware (`lib/security/csp.ts`, `strict-dynamic`,
      `frame-ancestors 'none'`, Supabase et Sentry seuls hôtes autorisés), HSTS conservé, test unitaire
      et e2e des en-têtes
- [x] **Sentry** (`@sentry/nextjs`, région UE, `sendDefaultPii: false`, actif seulement avec un DSN),
      `app/global-error.tsx`
- [x] Tests : 11 pgTAP (`008_rgpd.sql`), 3 unitaires (CSP)
- [ ] Valider sur une stack Supabase : inscription TOTP réelle, suppression d'un compte de démo, exécution
      de la purge, absence d'erreur CSP dans la console sur les pages connectées
- [x] Balayage mensuel des objets de stockage orphelins : `pnpm ops:storage-sweep` (session 15)

## Session 15 — détail

- [x] **Guides utilisateurs** (`content/guides/*.md`, français) : parents, enseignants, direction ; pages
      in-app `/aide` et `/aide/[slug]` (Markdown assaini), **export PDF** `/api/guides/[slug]`
      (`@react-pdf/renderer`, pagination) ; lien « Aide » dans le menu Plus
- [x] **Promotion de niveau** : fonction SQL `promote_school_year` (admin, transactionnelle, journalisée) —
      classes recréées au niveau suivant (nom proposé), élèves inscrits à la date de rentrée, fin de cursus
      → élèves sortis, année passée archivée (lecture seule), année suivante courante ; assistant
      `/admin/annees/promotion` avec correspondance modifiable et confirmation
- [x] `docs/DEMO.md` (déroulé de 15 minutes, comptes fictifs, points à souligner) et `docs/DEPLOIEMENT.md`
      (première mise en production, mises à jour, sauvegardes, exploitation récurrente)
- [x] Scripts d'exploitation : `scripts/ops/promote.sh` (link + `db push` + checklist),
      `pnpm ops:check-env --prod` (variables requises), `pnpm ops:storage-sweep [--delete]` (orphelins, RGPD §3)
- [x] Tests : 9 pgTAP (`009_promotion.sql`) ; README et scripts documentés
- [x] Isolation multi-établissement : `010_multi_school.sql` (39 assertions, seconde école fictive créée dans
      la transaction : lecture, écriture, fonctions, recherche, flux ICS) — 305 assertions pgTAP au total
- [x] Modèles d'e-mails Auth en français (`supabase/templates/`, câblés dans `config.toml`), workflow
      « Deploy database » (`supabase db push` + `config push` sur `main`), libellés « Fermer » traduits
- [ ] Jouer la démo sur `kesher-staging` avec la direction ; traduire les guides en anglais après les
      premiers retours ; captures d'écran pour les guides PDF

## Bilan V1

Les quinze sessions sont codées et testées localement (107 unitaires, 24 e2e, 305 pgTAP, build). Le projet
Supabase « Kesher » (`eu-west-3`) porte les 30 migrations, le jeu de données fictif, le compte de direction
du porteur, la configuration Auth (URL publique, redirections, inscription fermée, TOTP) et les quatre
jobs pg_cron. Restent : variables Vercel, expéditeur SMTP (Resend) puis modèles d'e-mails, rejouer les
validations « à valider sur une stack Supabase » listées dans chaque session, puis dérouler `docs/DEMO.md`.

## Revue de sécurité (2026-09-08)

Quatre lectures croisées (SQL / RLS, actions serveur, notifications et PWA, pages) ; corrections dans les
migrations `20260908172400` et `20260908172500` (ADR-0029) et dans l'application.

- [x] SQL / RLS : 2FA exigée pour les droits de direction, fonctions d'aide fermées à `anon` et aux
      tiers, modérateurs explicites, messages directs fermés, appartenance aux fils dérivée de l'accès,
      droit `can_message` appliqué, colonnes figées, audiences bornées à l'école, événements et
      évaluations revalidés, responsables en lecture seule sans signature ni réservation, absences
      déclarées non « justifiées » par le parent, journal d'audit par fonction, téléphone et motif de
      restriction séparés, bail sur les livraisons, digest sans doublon d'e-mail, mots réservés aux
      responsables autorisés, tags photo limités à la classe, médias lisibles selon la publication
- [x] Application : contrôle du nombre de lignes avant audit, propriété d'un billet avant les photos,
      réinvitation limitée aux membres, élève vérifié avant création de compte, nettoyage des envois
      refusés, neutralisation des formules CSV, exports traduits et gardés, livret réservé aux ayants
      droit, chemins de retour sans caractères de contrôle, 2FA évaluée sur tous les rôles
- [x] Notifications : repli exponentiel et gestion des 429, budget de temps du worker, digest horaire
      hors Chabbat (une fois par 20 h), planificateur unique (pg_cron, `vercel.json` sans cron),
      en-tête `List-Unsubscribe`, étiquette push par notification, secrets Vault hors éditeur SQL
- [x] PWA : nonce du script de thème, réabonnement push (`pushsubscriptionchange` + `/api/push/subscription`),
      désinscription à la déconnexion et à la reprise d'un appareil partagé, navigation vérifiée dans le
      service worker, cache versionné par build (`/sw.js` servi par une route)
- [x] Interface : cibles tactiles ≥ 44 px sur écran tactile (boutons compacts à partir de `md`), titres
      de fils traduits, libellés de niveau selon la langue, badge de restriction lisible, mots chargés en
      une requête, recherche et plafond sur la liste des familles, attestation à l'envoi de photos,
      enregistrement / retrait du droit à l'image par la direction (`set_image_rights`)
- [x] Consentements : opt-in dédié pour afficher ses coordonnées sur une petite annonce
      (`show_on_classifieds`), invitations acceptées une à une à l'onboarding
      (`activate_my_memberships(schools)`)
- [x] Revue de non-régression du durcissement : les invités voient l'école qui les invite (onboarding),
      affectation d'enseignants encore invités, changement de classe après promotion, modération
      réservée à la direction (cohérente avec la lecture des fils), colonnes figées compatibles avec les
      suppressions en cascade et les changements de classe, digest limité aux notifications réclamées,
      réactivation d'un membre resynchronisant ses fils, livraisons abandonnées purgées, abonnement push
      conservé à la déconnexion et ré-attaché à la connexion suivante, 2FA exigée dès l'entrée dans
      l'application pour la direction, responsables en lecture seule sans cases « vu » ni formulaires
- [x] Phase de recette : double authentification optionnelle par école (`modules.security.mfaRequired`,
      ADR-0030), à activer avant la mise en production réelle
- [ ] Reste à décider : limitation de débit du flux ICS (jeton de 192 bits, cache 15 min)

## Session 16 — Refonte de l'interface (ADR-0031)

Audit UI/UX de la version déployée, puis mise en œuvre des cinq arbitrages validés par le porteur.

- [x] Charte : thème clair « Blanc & Techelet » et thème sombre « Nuit Techelet » — bleus et blanc,
      le rouge brique réservé à ce qui attend le lecteur (ADR-0032) — jetons morts supprimés, `--brick` / `--success` / `--warning` ajoutés, axes `SOFT`/`WONK` de Fraunces activés,
      Source Serif 4 pour les textes institutionnels longs, échelle typographique unique
- [x] Largeur : plafond fluide `max-w-[110rem]`, paliers `xl:`/`2xl:`, colonne latérale
      d'administration, messagerie en deux volets, variable `--nav-h` partagée
- [x] Navigation : une barre par rôle, onglet « École », pôle « Publier », tableau de bord de direction,
      douze pastilles d'administration regroupées en quatre familles, « Plus » réduit au compte,
      compteur de messages non lus sur l'onglet
- [x] Messagerie : barre de conversation, groupage par auteur, rôles affichés, actions au menu,
      séparateur « Nouveaux messages », pagination remontante, recherche en surcouche
- [x] Contenus : `ContentCard`, `EmptyState`, `HubCard`, monogrammes teintés, écrêtage des corps
      Markdown, grille photo limitée avec « +N », agrandissement et couleur moyenne du blurhash
- [x] Six bugs corrigés : composeur masqué sur iPhone, bannière PWA superposée, réactions invisibles,
      recherche qui supprimait le composeur, « Vu par n » sans dénominateur, fil marqué lu à l'aveugle
- [x] `tests/unit/design-tokens.test.ts` : 47 assertions, dont la séparation des plans et le seuil 3:1
      des bordures de champ
- [ ] Validation visuelle par le porteur, puis passage en production

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
