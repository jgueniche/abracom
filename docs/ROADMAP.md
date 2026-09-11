# Feuille de route — Kesher

Une session ≈ 2–4 h de Claude Code, chacune **déployable, testée, committée**.
**MVP présentable à la direction = sessions 1–8.** Sessions 9–15 = V1 complète. État au 2026-09-11 : les vingt et une
sessions sont codées ; la session 18 a rejoué les validations « stack Supabase » qui pouvaient l'être
sans clés e-mail ni push (voir « Session 18 ») ; la session 19 ajoute la maîtrise du dialogue par la
direction et la pointeuse, toutes deux jouées à la main sur une stack réelle.

| #   | Livrable                                                                                                                     | Definition of done                                      | État                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Bootstrap : Next 15, Tailwind, shadcn, Supabase local, CI lint/test, Vercel preview, CLAUDE.md, ROADMAP                      | `pnpm dev` OK, déploiement preview vert                 | ✅                                                                                                   |
| 2   | Identité visuelle : extraction palette logo, tokens, thème clair/sombre, page de style `/dev/ui`                             | Validation visuelle par le porteur                      | ✅ (validation visuelle du porteur en attente)                                                       |
| 3   | Schéma BDD complet + RLS + `can_access_*` + seed fictif (1 école, 6 classes PS→CE1, 12 enseignants, 60 familles) + tests RLS | Tests RLS verts pour les 6 rôles                        | ✅ (336 assertions vertes sur PostgreSQL 16 + CI **et** sur une stack Supabase réelle, session 18)   |
| 4   | Auth : magic link, invitations, onboarding parent/enseignant, CGU versionnées, profil, multi-rôle                            | Flux e2e « invitation → 1re connexion »                 | ✅ (e2e « invitation → 1re connexion » vert sur une stack Supabase, session 18 — deux bugs corrigés) |
| 5   | Admin : écoles, années, classes, affectations, import CSV, invitations en masse                                              | Directrice fictive importe 60 familles en < 2 min       | 🟡 code complet, chronométrage de l'import à réaliser sur une stack Supabase                         |
| 6   | Annonces + accusés de lecture + documents + signatures                                                                       | Annonce ciblée classe avec relance des non-lecteurs     | 🟡 code complet, parcours à valider sur une stack Supabase (upload Storage, e-mails)                 |
| 7   | Espace classe : fil, devoirs, cahier de vie (upload photos), mots individuels                                                | Enseignant publie, parent voit et coche « vu »          | 🟡 code complet, upload photos à valider sur une stack Supabase                                      |
| 8   | Messagerie temps réel : DM, fils officiels, groupes de classe, modération, signalement                                       | 2 navigateurs, échange instantané, modération OK        | 🟡 code complet, échange à 2 navigateurs (Realtime) à valider sur une stack Supabase                 |
| 9   | Agenda : hebcal, événements, RSVP, créneaux bénévolat, ICS                                                                   | Abonnement ICS visible dans Google Calendar             | 🟡 code complet, abonnement ICS à vérifier dans Google Agenda sur une stack Supabase                 |
| 10  | Notifications : push, e-mail Resend, digest, préférences, **mode Shabbat**                                                   | Push reçu ; aucun envoi pendant fenêtre Shabbat simulée | 🟡 code complet ; push réel et e-mails à valider avec clés VAPID + Resend sur une stack Supabase     |
| 11  | Évaluations par compétences + livret PDF ; absences                                                                          | Livret PDF généré pour un élève fictif                  | 🟡 code complet ; livret PDF généré en test unitaire, rendu réel à valider sur une stack Supabase    |
| 12  | Communauté : annuaire opt-in, petites annonces, anniversaires, RDV parents-prof, formulaires                                 | Réservation de créneau fonctionnelle                    | 🟡 code complet, réservation de créneau testée en pgTAP ; parcours à valider sur une stack Supabase  |
| 13  | PWA, offline, recherche globale, accessibilité, performance (Lighthouse ≥ 90 mobile)                                         | Installable iOS/Android                                 | 🟡 code complet ; installation à valider sur iOS / Android, Lighthouse mesuré sur le déploiement     |
| 14  | RGPD : export, suppression, docs/RGPD.md, audit log, 2FA admin, CSP                                                          | Checklist §9 cochée                                     | 🟡 code complet ; 2FA et suppression de compte à valider sur une stack Supabase                      |
| 15  | Guides utilisateurs (PDF + pages in-app), démo scénarisée, script de bascule staging→prod, promotion de niveau               | Démo de 15 min prête pour la direction                  | 🟡 refondus en session 21 (43 articles par rôle, recherche, garde-fou de fraîcheur) ; démo à jouer   |

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

## Session 18 — Audit par rôle et corrections (2026-09-10)

Audit systématique des six rôles, écran par écran, sur une stack Supabase réelle (34 migrations, seed
fictif, PostgreSQL 17, GoTrue / Storage / Realtime), piloté par Playwright en `fr-FR` à 390 px et
1440 px : **582 visites d'écran**, axe-core sur chacune, plus trois passes complémentaires (parcours de
tous les liens visibles, profondeur réelle de chaque destination depuis la barre du téléphone, gestes
clés de chaque rôle joués à la main) et une vérification des droits en SQL sous l'identité de chaque
rôle. Trente-deux défauts relevés, hiérarchisés, puis corrigés dans l'ordre de gravité.

### Vérifications de la « stack Supabase » rejouées

- [x] **pgTAP sur Supabase** : `pnpm db:test:supabase` — 336 assertions vertes sur les schémas `auth` et
      `storage` réels, en plus du shim de la CI. Elles échouaient sur 7 assertions de durcissement
      jusqu'à ADR-0033.
- [x] **e2e « invitation → 1re connexion »** (definition of done de la session 4) : 28 tests verts
      contre la stack. Le parcours ne fonctionnait pas — deux causes, corrigées (voir plus bas).
- [x] `pnpm db:test` réparé : le script s'arrêtait au premier fichier sans `pg_prove`.
- [ ] Envois Resend et push VAPID : hors de portée sans clés.

### Bloquants corrigés

- [x] Responsable en lecture seule : plus d'onglet ni de lien « Évaluations », plus aucune porte vers la
      messagerie (onglet, boutons, « Discussion de la classe ») — l'agenda prend l'onglet libéré.
- [x] Enseignante sur téléphone : l'onglet **École** entre dans la barre ; annonces, documents,
      formulaires et communauté n'étaient atteignables par aucun chemin (ADR-0036).
- [x] `is_service_role()` : le privilège suit le contexte de requête, pas le rôle de connexion
      (ADR-0033) — les garde-fous de durcissement sont enfin vérifiés sur la plateforme.
- [x] Invitation → 1re connexion : `/auth/session` termine la poignée de main implicite, et les
      invitations en lot partent en mode implicite au lieu de PKCE, dont le vérificateur restait dans le
      navigateur de l'expéditeur.

### Gênants corrigés

- [x] Secrétariat : « Import CSV » et « Journal » ne sont plus dessinés pour lui (ADR-0035) ; en
      contrepartie il peut saisir une absence signalée au téléphone.
- [x] `/admin` : quatre familles repliées sur téléphone (≈ 830 px gagnés sur douze écrans), et un chiffre
      vivant par rubrique au lieu d'une copie de la barre latérale.
- [x] « Tableau de bord » passait à la ligne et débordait de sa colonne : la barre du téléphone dit
      « Accueil ».
- [x] Cartes de classe de la direction cliquables ; bouton principal qui nomme sa destination.
- [x] Accusé de lecture : les annonces qui en attendent un remontent en tête, et l'accueil mène
      directement à l'annonce quand il n'y en a qu'une.
- [x] Accessibilité : contraste AA des jours vides du cahier de texte, libellé du champ de pièce jointe,
      nom accessible de la case « vu », zones défilantes atteignables au clavier, 24 cases de
      `/notifications/preferences` portées à 44 px, lien logo à 44 px.
- [x] Seize états vides gagnent une sortie ou une explication ; `HubCard` partout ; « Salle Salle 1 » ;
      sous-titre de classe passé par next-intl ; 404 qui propose des routes de retour.

### Dette d'exploitation

- [x] **Garde-fou de build** : `scripts/ops/check-bundle.mjs`, exécuté en `postbuild`, échoue quand
      l'origine Supabase ou la clé anon est absente des bundles client. Le garde existant ne vérifiait
      que la _présence des variables_ ; celui-ci vérifie la _sortie_.
- [x] **Production saine**, vérifiée par le porteur : une conversation s'ouvre sur
      `abracom.vercel.app`, donc le bundle navigateur porte bien la configuration Supabase. Un premier
      diagnostic de cette session concluait le contraire ; il était faux, parce qu'il ne lisait que les
      chunks référencés par `/connexion`, alors que la configuration n'est compilée que dans le chunk de
      la conversation temps réel (`app/(app)/messages/[threadId]`) — le seul écran qui utilise le client
      navigateur, et donc le seul test qui tranche. Un build sain aurait répondu exactement pareil.
      À retenir pour la prochaine fois : un bundle se vérifie sur tout `.next/static`, pas sur les
      scripts d'une page, ce que fait `check-bundle`.
- [ ] Resend à brancher, puis décommenter les modèles d'e-mails de `supabase/config.toml` (le gratuit
      refuse les modèles personnalisés avec l'expéditeur par défaut). Les modèles utilisent déjà le flux
      token-hash de `/auth/confirm` ; `/auth/session` couvre le flux implicite en attendant.

## Session 19 — Le robinet du dialogue, la pointeuse, et un coup de rabot (2026-09-10)

Deux demandes explicites de la directrice, puis un rabot sur ce qui restait trop compliqué pour un
parent pressé. Huit arbitrages posés au porteur avant la première ligne de SQL (ADR-0037 à ADR-0039).

### A — Maîtrise du dialogue par la direction

- [x] Interrupteur d'école dans `schools.modules -> 'messaging' ->> 'parentToStaff'`
      (`open` / `closed` / `scheduled`) avec les publics concernés, écrit par `set_messaging_mode`
      (audité, et il normalise le `messaging: true` que le seed portait encore).
- [x] `messaging_windows` : une période datée qui **ouvre** ou **ferme** un canal — la permanence du
      mardi soir et la quinzaine de juin sont le même objet avec un `kind` différent — resserrable
      sur une classe ou sur une seule personne de l'équipe. RLS : lecture par l'équipe, écriture par
      la direction seule.
- [x] **Application par les RLS** : `can_post_in_thread` (appelée par `messages_insert`) refuse
      l'INSERT quand le canal est fermé, et `can_direct_message` applique la même règle à l'ouverture
      d'une conversation. Une interface qui masque le champ sans que la base ne refuse n'est pas une
      fermeture, c'est un décor.
- [x] Le bouton de l'enseignant sur son propre fil : « Les familles peuvent répondre » / « Annonce
      seule », plus la dérogation d'ADR-0038 (rouvrir malgré une fermeture d'école), auditée et
      visible de la direction, qui peut la retirer.
- [x] Vue du parent : jamais de bouton mort — une phrase par next-intl, la date de réouverture
      seulement si une période le dit, et le contact d'urgence tel que la direction l'a saisi.
- [x] « Heures de réponse » supprimée : la phrase promettait 48 h ouvrés et rien ne l'appliquait.
      Remplacée par `messaging_current_closing()` — la fin de la période d'ouverture en cours.
- [x] `/admin/messagerie` : état de chaque canal, un interrupteur par ligne, et la charge réelle
      (`messaging_load`, huit semaines, par classe et par enseignant).
- [x] 30 assertions pgTAP, chacune se terminant sur un vrai INSERT dans `public.messages`.

### B — La pointeuse (ADR-0039)

- [x] Périmètre consigné **avant** le SQL : présence, arrivée, départ, qui récupère l'enfant. Pas de
      facturation, mais un modèle qui peut l'alimenter (code de service, date, deux horodatages).
- [x] `attendance_lists` (appel de classe · service récurrent · sortie), `attendance_sessions`
      (occurrence datée, ouverte puis clôturée), `attendance_records` (statut, heures, qui récupère).
- [x] Droit de pointer accordé **liste par liste** (`attendance_list_managers`) : aucune animatrice du
      soir n'hérite des droits du secrétariat. Vérifié en SQL sous l'identité de chaque rôle.
- [x] **Le point de sécurité** : un responsable sous restriction judiciaire n'est jamais proposé et est
      refusé en base (`attendance_pickup_guard`), assertion pgTAP dédiée.
- [x] Grille ludique : vignettes de 173 × 163 px, initiales sur pastille teintée, une tape = présent
      avec l'heure, une seconde annule, compteur permanent, « Qui manque ? », départs en second passage.
- [x] **Hors ligne** : file dans `localStorage`, rejouée dans l'ordre au retour du réseau, chaque
      pointage portant l'heure de la tape. Testé réseau coupé : trois pointages en file, zéro perdu.
- [x] Liste d'une sortie créée depuis l'événement de l'agenda ; récapitulatif CSV de fin de service.
- [x] Rétention 12 mois glissants dans `purge_expired_data()` et dans `docs/RGPD.md`.
- [x] 39 assertions pgTAP. Deux défauts trouvés à la main et corrigés : une annulation qui repointait
      l'enfant (`status_: undefined` retombait sur la valeur par défaut, d'où `clear_attendance`), et
      un export CSV à l'heure UTC au lieu de l'horloge de l'école.

### C — Simplicité (le rabot)

- [x] Accueil du parent : un bloc **« Aujourd'hui »** (annonce à confirmer, devoirs du jour et du
      lendemain, mot non lu, circulaire à signer, événement du jour), la carte d'accusés de lecture
      repliée dedans — la page perd un bloc au lieu d'en gagner un.
- [x] Bouton **« Bravo »** d'une tape depuis la liste de classe, la phrase envoyée affichée sur le
      bouton avant l'envoi.
- [x] Marquer « vu » depuis la liste : **déjà en place** depuis la session 17, rien à faire.
- [ ] Mosaïque du cahier de vie : non jugeable sur une stack dont le seed ne porte aucune photo
      (`class_post_media` vide). À reprendre avec de vraies images.
- [ ] Premier lancement du parent en trois écrans : écarté pour l'instant — découper un formulaire en
      trois étapes ajoute des écrans là où le chantier demandait d'en retirer.

### Correctif de découvrabilité (2026-09-11)

Signalé depuis le déploiement réel : la pointeuse était introuvable pour les trois rôles. Les migrations
étaient bien passées (`2 applied, 36 already present`) ; ce sont les écrans qui se cachaient.

- [x] `/pointage` renvoyait à l'accueil **sans un mot** quand le lecteur ne détenait aucune liste — le
      renvoi silencieux que la session 18 avait supprimé partout ailleurs, réintroduit. Comme les listes
      de démonstration ne vivent que dans le seed, jamais rejoué en production, tous les comptes en
      détenaient zéro : il fallait une liste pour voir la pointeuse, et la pointeuse était l'endroit où
      l'on apprenait que les listes existent.
- [x] La page dit désormais ce qui manque : « Aucune liste de pointage » et un bouton de création pour la
      direction, « Aucune liste ne vous est confiée » et pourquoi pour les autres.
- [x] La carte d'accueil ne rendait rien quand la personne détenait des listes mais qu'aucune n'était
      prévue du jour, ce qui privait le téléphone de toute route ; une ligne discrète y mène.
- [x] `/admin` affiche un chiffre vivant à côté de Pointage.

### Recette

- 405 assertions pgTAP vertes sur les deux chemins (`pnpm db:test` **et** `pnpm db:test:supabase`).
- Les deux fonctionnalités jouées à la main sur une stack Supabase réelle, à 390 px et 1440 px,
  sous six identités ; pointeuse testée réseau coupé ; axe-core propre sur chaque écran nouveau.

## Session 20 — Les trois écarts Educartable retenus (2026-09-11)

Les trois que la session 19 avait chiffrés et retenus, livrés d'un bloc (ADR-0040 à ADR-0042).

- [x] **Emploi du temps de la classe** : `class_timetable` (jour ISO, deux heures, matière, intervenant,
      salle), onglet dans l'espace de classe, lu par les familles et par un responsable en lecture seule,
      écrit par l'équipe de la classe et le secrétariat. Lu comme une liste de jours, pas comme un
      tableau croisé — illisible à 390 px. Un créneau ne peut nommer qu'un intervenant de la classe.
- [x] **Mot d'excuse signé depuis le téléphone** : `absence_justifications` et
      `declare_and_sign_absence()` — le mot et l'absence dans une seule transaction, le nom tapé,
      l'horodatage imposé par la base. Signer **soumet** une justification, l'école l'**accorde** :
      `absences.status` reste hors de portée de la famille. Le justificatif scanné reste possible.
- [x] **Suivi des retards** : `late_report()` additionne les deux registres — le déclaré et le constaté —
      en les gardant distincts, onglet « Retards » réservé à l'équipe, fenêtres 30 j / 3 mois / année,
      export CSV. Aucune table nouvelle : le manque était arithmétique.
- [x] 31 assertions pgTAP ajoutées (436 au total), vertes sur `pnpm db:test` **et**
      `pnpm db:test:supabase`. Les trois écrans joués à la main sur une stack Supabase réelle à 390 px et
      1440 px ; axe-core propre sur chacun. Un défaut d'affichage corrigé en chemin : à 390 px le nom de
      l'élève s'enroulait et les compteurs de retard se glissaient au milieu.

Restent écartés, comme évalué en session 19 : le **trombinoscope** (cher là où on ne le voit pas, tant
que les droits à l'image ne sont pas majoritairement signés), et **objets trouvés / covoiturage**, déjà
livrés comme deux catégories des petites annonces.

## Session 21 — Une aide qui s'adresse à chacun, qui se cherche, et qui ne périme plus (2026-09-11)

L'aide datait de la session 15 : trois guides monolithiques pour six rôles, cinq sessions de retard, et
aucun moyen d'y chercher quoi que ce soit. Le secrétariat était renvoyé au guide de la direction, un
responsable en lecture seule à celui des parents, l'administrateur de plateforme à rien.

- [x] **A — 43 articles courts** (`content/help/*.md`), un par question, avec un front-matter qui déclare
      `title`, `roles`, `routes`, `topic`, `keywords`, `since` et `reviewed`. `/aide` n'affiche que les
      articles du lecteur, rangés en cinq thèmes ; ce qui ne le concerne pas est **absent**, pas grisé.
      Un bloc `:::roles` réserve une phrase à une partie de l'audience — un responsable en lecture seule
      ne lit jamais « ouvrez la messagerie » (ADR-0044). Sessions 16 à 20 couvertes : `/devoirs`,
      navigation par rôle, groupes et sondages, robinet du dialogue, pointeuse, bloc « Aujourd'hui »,
      emploi du temps, mot d'excuse signé, retards. PDF « mon guide » par rôle (ADR-0048).
- [x] **C — garde-fou de fraîcheur** `scripts/ops/check-help.mjs`, dans `pnpm check` et en CI
      (ADR-0046). Il déduit l'audience de chaque écran de `app/(app)` de la garde appelée par sa page
      (ou par le layout le plus proche) et **échoue** si un rôle qui atteint un écran n'a aucun article,
      si un article documente une route disparue, ou si son `reviewed:` précède le dernier commit de
      l'écran décrit (comparaison au jour près). Carte `EXEMPT` versionnée, vide aujourd'hui : les
      68 écrans sont couverts. Règle écrite dans `CLAUDE.md` §9 et dans la checklist de PR §6. Un « ? »
      dans chaque en-tête ouvre l'article de l'écran courant ; `/aide/quoi-de-neuf` liste les nouveautés
      du rôle, marqueur de lecture dans le navigateur (ADR-0050).
- [x] **B — recherche** en direct sur `/aide` (titre, mots-clés, corps), insensible aux accents et à la
      casse, extraits surlignés, état vide qui propose une sortie plutôt qu'une impasse ; `/recherche`
      remonte les articles à côté des annonces, sans copier un fichier en base (ADR-0045).
- [x] Défaut réel corrigé en chemin : `position: absolute` + `fixed` + `render` est une mise en page que
      `@react-pdf` ne sait pas faire au-delà d'une douzaine de pages. Invisible tant que les guides
      tenaient sur une page, fatale pour « mon guide » de la direction.
- [x] 156 tests unitaires (parseur, filtrage par rôle, recherche, rendu PDF des six rôles),
      436 assertions pgTAP inchangées et vertes sur `pnpm db:test`, 26 e2e verts, `pnpm build` vert.
- [ ] **Parcours à six rôles sur une stack Supabase réelle, à 390 px et 1440 px, axe-core sur `/aide`,
      `/aide/[slug]`, `/aide/quoi-de-neuf` et le « ? »** : impossible dans l'environnement de la
      session (aucun démon Docker, donc ni `db:start` ni `db:test:supabase`). Le filtrage par rôle est
      vérifié en test unitaire sur le contenu réel, écran par écran ; il reste à le rejouer à l'œil.
- [ ] **Captures d'écran dans les articles** (piste D) : principe arbitré — seed fictif, régénération en
      CI, jamais de données réelles (ADR-0049) — mise en œuvre reportée, elle suppose une stack.
- [ ] Écartés de la piste D, faute de valeur claire à ce stade : premier lancement guidé (l'aide
      contextuelle répond déjà au même besoin sans ajouter d'écran à traverser), glossaire (les termes
      sont définis là où ils servent), « cet article vous a-t-il aidé ? » (un compteur, même anonyme, sur
      des comptes liés à des mineurs, pour un corpus que la CI relit déjà), visite guidée sur l'écran.
      L'aide hors ligne est acquise sans travail : les articles sont statiques et partent avec la page.

## Session 22 — Le trait plutôt que la boîte (ADR-0051)

Refonte purement graphique demandée par le porteur à la revue des sessions 16–17 : « l'app est très
_Claude like_ », « beaucoup de textes et d'encarts sont trop gros, les titres aussi », « des sous-titres
n'ont pas de cohérence de place, de taille ou de position ». Aucune route, aucun libellé, aucun droit ne
change — les 43 articles d'aide restent donc exacts.

- [x] Fonte : **Newsreader** remplace Fraunces, Source Serif 4 est supprimée ; deux familles, et une
      règle de partage — la serif est la voix de l'école, le sans est l'interface
- [x] Échelle : les crans de titre recoupés dans `@theme` (−20 à −30 %), texte courant inchangé,
      interligne et approche portés par chaque cran
- [x] Géométrie : `--radius` de 14 px à 8 px, la pilule réservée à ce qui est rond
- [x] Relief : l'ombre cède au filet, jeton `--rule` pour les séparateurs internes
- [x] Couleur : `--surface` / `--secondary` / `--accent` / `--input` désaturés à luminance identique
      (SC 1.4.11 tenu), survols en gris et non plus en bleu, onglet actif marqué d'un trait
- [x] Composants partagés : `SectionHeader` (21 `<h2>` à six tailles), `RowList` / `Row` (neuf listes
      écrites à la main), `FilterChip` / `FilterChips` (six rangées de pilules pleines)
- [x] `/dev/ui` : section **Anatomie d'écran** et spécimen de l'échelle, pour une validation visuelle
      sur une vraie page plutôt que sur une planche de composants
- [ ] Validation visuelle par le porteur

## Session 23 — La forme suit le contenu (ADR-0052)

Premier audit de design mené sur une **stack Supabase réelle** (Docker + seed) : six rôles, écrans
connectés, 390 px et 1 440 px, clair et sombre. Le registre typographique de la session 22 tenait ; la
composition, non.

- [x] Trois largeurs choisies par le genre de l'écran (`Column` : `text`, `index`, `full`)
- [x] `IndexList` / `IndexEntry` : les publications se composent comme un index, pas comme une grille
- [x] `Table` : un registre est tabulaire (66 élèves, 11 152 px → 6 374 px)
- [x] Une circulaire composée comme une lettre ; accusé et pièces jointes en appareil
- [x] Hubs en sommaires, tableau de bord en planche de chiffres, semaine de devoirs en liste continue
- [x] Icônes décoratives et pastilles retirées ; « ceci vous attend » devient une barre dans la marge
- [x] Mouvement réduit, barres de défilement fines, feuille d'impression
- [x] 28 e2e verts (invitation comprise), 436 assertions pgTAP, axe à 0 sur neuf écrans connectés
- [ ] Validation visuelle par le porteur

## Écarts avec Educartable et consorts — évaluation (session 19)

Demandé avant d'écrire quoi que ce soit. Constaté à l'écran et en base sur une stack Supabase réelle
le 2026-09-10. Le chiffrage est en sessions de travail (≈ 2–4 h), écran + SQL + tests + recette compris.

| Écart                               | Ce qui existe déjà                                                                                      | Reste à faire                                                                           | Coût      | Verdict                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- | -------------------------------- |
| **Emploi du temps de la classe**    | Rien. Aucune table d'horaires.                                                                          | Table `class_timetable` (jour, créneau, matière, intervenant), écran classe, impression | 1 session | **Vaut le coup** — n° 1          |
| **Mot d'excuse signé du téléphone** | `absences` (déclaration + pièce jointe) et `document_signatures` (signature horodatée, IP, navigateur)  | Rapprocher les deux : une signature au doigt vaut justificatif, sans scan ni papier     | ½ session | **Vaut le coup** — n° 2          |
| **Suivi des retards**               | `absences.kind = 'late'` (déclaré) **et**, depuis la session 19, `attendance_records.status/arrived_at` | Une vue par élève et par classe qui additionne les deux registres, exportable           | ½ session | **Vaut le coup** — n° 3          |
| **Autorisation de sortie signée**   | `documents.requires_signature` + `signature_per_student`, relances et export CSV                        | Rien. C'est fait, et c'est le cas d'usage pour lequel la signature a été construite     | 0         | Déjà là — à montrer en démo      |
| **Objets trouvés**                  | `community_category = 'lost_found'`, modération a priori, écran et libellés                             | Rien de fonctionnel ; au mieux une photo au lieu d'un texte                             | 0         | Déjà là                          |
| **Covoiturage**                     | `community_category = 'carpool'`, mêmes garanties                                                       | Rien. Un vrai module d'appariement serait une application à part                        | 0         | Déjà là — ne pas aller plus loin |
| **Trombinoscope**                   | `students.photo_path`, `class_teachers`, droit à l'image signé par élève                                | Un écran, plus la chaîne de photos (upload en masse, vignettes, URL signées)            | 1 session | **Du bruit pour l'instant**      |

**Recommandation** : trois choses, dans cet ordre — emploi du temps, mot d'excuse signable,
suivi des retards. Elles se tiennent : ce sont les trois raisons pour lesquelles une famille garde
Educartable ouvert à côté, et les trois seules du tableau qui demandent du code neuf tout en
s'appuyant sur des briques déjà testées.

**Le trombinoscope est écarté** — non parce qu'il est difficile, mais parce qu'il est cher là où on ne
le voit pas : sans photos il est vide, et les photos supposent une collecte, un consentement par
élève (le droit à l'image existe déjà, mais il est signé par une minorité de familles au démarrage),
un traitement d'images et un balayage de rétention. C'est un écran d'une session et une chaîne
d'exploitation de plusieurs. À reprendre quand les droits à l'image seront majoritairement signés.

**Objets trouvés et covoiturage sont déjà livrés** et personne ne le sait : ce sont deux catégories
des petites annonces, modérées a priori. Le manque n'est pas fonctionnel, il est de notoriété — deux
entrées nommées depuis le pôle Communauté suffiraient, et cela ne coûte rien.

## Questions ouvertes (§15 du brief)

Bloquantes pour la session 2 :

1. **Palette** : le logo est-il monochrome ? Si oui, choix entre bleu profond / or doux et bleu nuit / sable.
2. ~~**Typographie des titres** : Fraunces ou Newsreader~~ — **tranchée en session 22** : Newsreader.
   Fraunces a composé les titres des sessions 2 à 21 ; à la revue, ses axes `SOFT` / `WONK` se sont
   révélés être exactement ce que le porteur voulait quitter. Newsreader, à axe optique, sert désormais
   les titres **et** la prose longue, et Source Serif 4 disparaît (ADR-0051). Inter reste l'interface.

Non bloquantes avant la session 3 (à trancher pour les sessions 3–10) :

3. Nom définitif et domaine (`kesher-abravanel.fr` ? sous-domaine de institutions-abravanel.fr ?).
4. ~~Educartable : simple lien profond~~ — **tranchée** : lien retiré, les devoirs sont publiés dans
   Kesher (cahier de texte `/devoirs`), la plateforme ne renvoie plus vers un site externe.
5. Évaluations : compétences uniquement en maternelle ; notes chiffrées optionnelles en élémentaire ?
6. Groupes de classe : enseignant présent par défaut ou « parents seuls » avec parent délégué ?
7. Petites annonces / marketplace : autorisées par la direction ?
8. SMS (Twilio) pour urgences : budget accepté ?
9. Fournisseur e-mail : Resend (UE) ou domaine e-mail de l'école (SPF/DKIM) ?
10. Levallois : échéance d'activation ?
11. **Supabase cloud** : `kesher-staging` dans une organisation gratuite dédiée, région `eu-west-3` (décidé le 2026-09-08, voir Session 1 — détail).
