# Décisions d'architecture (ADR)

Format court : contexte → décision → conséquences. Une entrée par décision structurante non couverte
par le brief. Numérotation croissante, jamais réécrite (on ajoute un ADR qui remplace l'ancien).

## ADR-0001 — Next.js 15.5 épinglé (pas 16)

- **Contexte** : le brief impose Next.js 15 ; Next 16 est disponible au moment du bootstrap.
- **Décision** : `next@15.5.x` épinglé (avec `eslint-config-next@15.5.x`), React 19.1, Turbopack en dev.
- **Conséquences** : montée vers Next 16 à décider explicitement (ADR dédié) une fois le MVP validé ;
  `experimental.typedRoutes` non activé.

## ADR-0002 — i18n sans préfixe de locale dans les URLs

- **Contexte** : application privée, derrière authentification, deux langues (`fr`, `en`). Un segment
  `[locale]` compliquerait chaque groupe de routes `(parent)`, `(teacher)`, `(admin)`.
- **Décision** : `next-intl` en mode « sans routing ». Locale résolue côté serveur dans
  `lib/i18n/request.ts` : cookie `NEXT_LOCALE` → `Accept-Language` → `fr`. En session 4, la locale du
  profil utilisateur (`profiles.locale`) prendra le pas sur le cookie.
- **Conséquences** : pas de middleware i18n, URLs identiques dans les deux langues ; le changement de
  langue est une Server Action (`lib/i18n/locale.ts`) qui écrit le cookie puis `revalidatePath`.

## ADR-0003 — shadcn/ui v4, preset « Nova » sur Radix

- **Contexte** : shadcn CLI v4 impose un preset (Nova, Vega…) et une base (`radix`, `base`, `aria`).
- **Décision** : preset `nova` (Lucide / Geist, le plus proche du shadcn « classique ») sur base
  **Radix**, variables CSS activées, composants générés dans `components/ui/` (ne pas modifier à la main :
  régénérer via `pnpm dlx shadcn add <composant> --overwrite`). `lib/utils.ts` ré-exporte `cn` du paquet
  `cn` installé par le registre (équivalent clsx + tailwind-merge).
- **Conséquences** : les tokens (`--primary`, `--accent`, `--radius`…) sont ceux de shadcn ; la session 2
  les redéfinit dans `app/globals.css` à partir du logo (`primary`, `primary-foreground`, `accent`,
  `surface`, `muted`) sans toucher aux composants.

## ADR-0004 — Supabase CLI en devDependency, Docker requis localement

- **Contexte** : le brief demande une stack Supabase locale ; l'environnement de la session 1 n'a pas
  de démon Docker.
- **Décision** : `supabase` (CLI) en devDependency (`pnpm db:*`), `supabase/config.toml` versionné
  (projet `kesher`, seeds `supabase/seed/*.sql`). `supabase start` s'exécute sur le poste du développeur
  (Docker Desktop / OrbStack). La CI ne démarre pas Supabase avant la session 3 (tests RLS).
- **Conséquences** : les clés locales (`pnpm db:status`) vont dans `.env.local`. Le projet cloud
  `kesher-staging` sera créé dans une organisation Supabase gratuite dédiée (l'organisation existante
  facturerait 10 $/mois), en région `eu-west-3` (Paris), décision du porteur du 2026-09-08.

## ADR-0005 — Variables d'environnement validées par zod, Supabase optionnel au démarrage

- **Contexte** : l'app doit démarrer (`pnpm dev`, build CI) avant qu'une base existe.
- **Décision** : `lib/env.ts` (public, `NEXT_PUBLIC_*`, valeurs par défaut) et `lib/env.server.ts`
  (`server-only`). Les clients Supabase (`lib/supabase/*`) résolvent la configuration paresseusement et
  lèvent `MissingSupabaseConfigError` (message en français) si elle manque.
- **Conséquences** : la CI construit avec des valeurs factices ; à partir de la session 3 les variables
  Supabase deviendront obligatoires pour les routes qui en dépendent (pas globalement).

## ADR-0006 — En-têtes de sécurité de base maintenant, CSP stricte en session 14

- **Contexte** : une CSP stricte avec nonces exige un middleware et casse le dev sans réglages fins.
- **Décision** : `next.config.ts` pose nosniff, `X-Frame-Options: DENY`, Referrer-Policy,
  Permissions-Policy, HSTS ; `robots` interdit l'indexation ; `poweredByHeader` désactivé.
  CSP stricte + cookies + audit dans la session 14 (checklist §9).
- **Conséquences** : test e2e `sends baseline security headers` à étendre à la CSP en session 14.

## ADR-0007 — Tests : Vitest 3 + Playwright (mobile et desktop)

- **Décision** : Vitest 3 (`tests/unit`, jsdom, imports explicites, pas de globals) ; Playwright avec
  deux projets (`Pixel 7`, `Desktop Chrome`), `locale fr-FR`, `Europe/Paris`. En CI (`CI=1`) les e2e
  tournent contre `next start` après build. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet d'utiliser un
  Chromium pré-installé (sandbox) sans téléchargement.
- **Conséquences** : Vitest 5 / TypeScript 7 à évaluer plus tard ; tests RLS (pgTAP ou SQL) en session 3.

## ADR-0008 — Déploiement Vercel lié à GitHub, région `cdg1`

- **Décision** : projet Vercel `abracom` importé depuis le dépôt GitHub par le porteur (previews
  automatiques par branche / PR, production sur la branche de production configurée dans Vercel).
  La création via l'intégration Vercel de la session 1 avait été refusée (`403 forbidden`).
  `vercel.json` fixe `regions: ["cdg1"]` (Paris) pour les fonctions serverless, conformément à
  l'hébergement UE (§9). Vercel construit avec Node 24.x (compatible ; la CI reste sur Node 22 via
  `.nvmrc`). Les previews sont protégées par Vercel Authentication (plan Hobby) : les captures pour
  la direction se font depuis un compte Vercel connecté ou depuis la production.
  Pas d'analytics tiers ; Vercel Analytics privacy-first éventuellement plus tard (session 13), sans cookies.
- **Conséquences** : les variables `NEXT_PUBLIC_SUPABASE_*` de preview pointeront vers `kesher-staging`
  une fois créé ; jusque-là les previews tournent sans base (sessions 1–2).

## ADR-0009 — Conventional Commits appliqués par Husky + commitlint

- **Décision** : `pre-commit` → lint-staged (ESLint --fix + Prettier), `commit-msg` → commitlint
  (`@commitlint/config-conventional`). Messages en anglais.

## ADR-0010 — Palette dérivée du logo polychrome, une seule proposition

- **Contexte** : le brief prévoyait deux palettes si le logo était monochrome. Le logo officiel est
  polychrome : aleph et étoile sarcelle `#01525e`, titre et mandala rouge brique `#852624`, pétales or doux
  `#e3b383` / `#fbe29e`, traits du livre taupe `#584a47` (extraction par comptage de pixels,
  `scripts/brand/extract-palette.mjs`).
- **Décision** : une seule palette dérivée. `primary` = sarcelle (légèrement éclairci en clair, pastel en
  sombre), `secondary` = sable / or doux, `accent` = sarcelle très pâle (survols), `destructive` = rouge
  brique, neutres chauds tirés du taupe, fond clair « papier » `oklch(0.985 0.006 80)`, fond sombre « bleu
  nuit » `oklch(0.2 0.014 220)`. Tokens supplémentaires : `surface`, `brand-*`, `shadow-soft`. Toute paire
  texte doit rester ≥ 4,5:1 (test unitaire bloquant), l'anneau de focus ≥ 3:1.
- **Conséquences** : les composants shadcn ne sont pas modifiés ; un changement de teinte se fait uniquement
  dans `app/globals.css` (+ `lib/design/tokens.ts` pour le fond) et doit passer le test de contraste.

## ADR-0011 — Typographies Inter + Fraunces

- **Décision** : Inter pour l'interface (`--font-sans`), Fraunces (axe optique) pour les titres
  (`--font-heading`, appliqué aux `h1`–`h4` par la couche de base), pile monospace système pour les
  horodatages. Chargement par `next/font/google` (auto-hébergé au build, pas de requête Google côté
  utilisateur, `display: swap`).
- **Conséquences** : Newsreader reste l'alternative si le porteur préfère une serif plus classique ;
  le changement se limite à `app/layout.tsx`.

## ADR-0012 — `/dev/ui` visible en preview Vercel, 404 en production

- **Décision** : le guide de style est servi en développement et lorsque `VERCEL_ENV=preview`, pour que le
  porteur valide l'identité depuis son téléphone sans installer le projet. Il renvoie 404 en production.
- **Conséquences** : aucune donnée réelle n'y figure (contenus fictifs traduits) ; la CI teste le 404 en
  mode production.

## ADR-0013 — Validation des migrations et des RLS sur PostgreSQL 16 local (shim Supabase)

- **Contexte** : ni Docker ni projet Supabase cloud n'étaient disponibles pour la session 3 ; le brief
  exige des tests RLS verts pour chaque rôle.
- **Décision** : `supabase/tests/local/auth-shim.sql` reproduit le strict nécessaire de la plateforme
  (schémas `auth` et `storage`, `auth.uid()` / `auth.jwt()` lisant `request.jwt.claims`, rôles `anon` /
  `authenticated` / `service_role`, grants par défaut). `scripts/db/test-local.sh` enchaîne reset → shim →
  migrations → seed → pgTAP (`pg_prove`). Le job CI `database` installe PostgreSQL 16 + pgTAP sur le runner.
  Les migrations restent 100 % compatibles Supabase (elles ne référencent que `auth.users`, `auth.uid()`,
  `storage.buckets` / `storage.objects` et le schéma `extensions`).
- **Conséquences** : `supabase test db` sur la vraie stack reste la référence et doit être rejoué dès
  qu'une stack existe ; toute divergence (par exemple une extension absente) se corrige dans la migration,
  jamais dans le shim. PostgreSQL local = 16, Supabase = 17 : éviter les fonctionnalités propres à 17.

## ADR-0014 — Patrons RLS

- **Décision** :
  - toutes les décisions d'accès passent par des fonctions `security definer` figées sur
    `search_path = public` (jamais de sous-requête RLS récursive, en particulier entre `threads` et
    `thread_members`) ;
  - `(select auth.uid())` dans chaque politique pour bénéficier du cache d'initPlan ;
  - audiences (`school` / `level` / `class` / `custom`) résolues par `matches_audience`, partagée par
    annonces, documents, formulaires et événements ;
  - visibilité d'un enfant = `student_guardians` non bloqué + `enrollments` actives ; le rôle de
    membership (`parent` vs `guardian`) décide des droits d'écriture et des évaluations ;
  - les coordonnées entre parents ne circulent que via `directory_optins` (les parents d'une famille
    séparée ne se voient pas sans opt-in) ;
  - notes confidentielles de la direction dans une table dédiée (`student_private_notes`) plutôt qu'une
    colonne, car RLS ne filtre pas les colonnes ;
  - `notifications` insérées uniquement côté serveur (pas de politique d'insertion utilisateur).
- **Conséquences** : toute nouvelle table doit arriver avec `enable row level security`, ses politiques,
  un index sur chaque FK et une assertion pgTAP (la CI échoue si une table publique reste sans RLS).

## ADR-0015 — Authentification : invitations Supabase + magic link, onboarding bloquant

- **Décision** :
  - aucun formulaire d'inscription : les comptes sont créés par la direction (`auth.admin.inviteUserByEmail`,
    e-mail français avec lien signé par GoTrue) ; la page `/connexion` n'envoie qu'un magic link
    (`shouldCreateUser: false`) et répond de la même façon pour une adresse inconnue ;
  - `@supabase/ssr` avec cookies : `middleware.ts` rafraîchit la session à chaque requête et redirige
    vers `/connexion?next=` ; `getCurrentUser()` (React `cache`) charge profil + memberships une fois par
    requête ;
  - première connexion bloquante sur `/bienvenue` tant que le prénom est vide ou qu'un texte légal courant
    (CGU, charte, confidentialité — versionnés par école ou globaux) n'est pas accepté ; l'acceptation est
    horodatée et l'activation des memberships passe par `activate_my_memberships()` (security definer) ;
  - multi-rôle par « perspective » (admin > enseignant > parent) stockée dans un cookie et validée
    côté serveur contre les memberships ;
  - clés étrangères supplémentaires vers `profiles` pour permettre les jointures PostgREST sans exposer
    `auth.users`.
- **Conséquences** : l'OTP SMS (Twilio) reste optionnel (§15) ; les URL de redirection autorisées doivent
  inclure les previews Vercel (`https://*-jeremys-projects-472f663b.vercel.app/**`) dans la configuration
  Supabase ; le rate limiting applicatif (Upstash / table) arrive en session 14.

## ADR-0016 — Import CSV en deux temps et invitations par lots

- **Contexte** : la directrice doit importer 60 familles (≈ 130 comptes) en moins de deux minutes ; les
  Server Actions Vercel ont une durée maximale courte et l'envoi d'e-mails est la partie lente.
- **Décision** : l'import crée les données (familles, élèves, inscriptions, liens) et les comptes avec
  `auth.admin.createUser({ email_confirm: true })` **sans e-mail**, memberships en statut `invited` ;
  l'envoi des invitations est une action séparée qui traite 20 memberships par appel
  (`signInWithOtp` → e-mail « magic link » en français, `invited_at` horodaté). L'import est idempotent
  (élève identifié par prénom + nom + date de naissance, compte par e-mail, `upsert` des liens) et
  re-jouable après correction du fichier. Les erreurs sont rapportées ligne par ligne, jamais bloquantes
  pour les autres lignes.
- **Conséquences** : la recherche d'un compte par e-mail passe par `find_user_id_by_email` (service role
  uniquement) ; la suite naturelle est un envoi automatique par tâche planifiée (session 10).

## ADR-0017 — Éditeur Markdown léger d'abord, tiptap différé

- **Contexte** : le brief prévoit tiptap. Tiptap est un éditeur HTML/ProseMirror ; produire et relire du
  Markdown fidèle demande une couche de sérialisation supplémentaire et une dizaine de paquets.
- **Décision** : les annonces, posts et mots sont stockés en Markdown (`body_md`) et rendus par
  `react-markdown` + `remark-gfm` + `rehype-sanitize` (jamais de HTML brut, liens sûrs). L'éditeur est un
  `textarea` Markdown avec barre d'outils (gras, italique, liste, lien) et aperçu instantané. Le passage à
  tiptap (avec export Markdown) est prévu en session 13 (ergonomie) si la direction le souhaite ; le
  stockage ne change pas.
- **Conséquences** : rendu identique côté e-mail (session 10) et PDF (session 11) à partir du même Markdown.

## ADR-0018 — Destinataires, relances et signatures calculés en SQL

- **Décision** : `announcement_recipients(id)` (membres actifs qui correspondent à l'audience, avec leurs
  horodatages de lecture / confirmation), `remind_announcement(id)` (notifications in-app pour les
  non-lecteurs + entrée d'audit) et `document_missing_signatures(id)` sont des fonctions `security definer`
  réservées au personnel de l'école (contrôle `is_school_staff` à l'intérieur). L'application n'a ainsi
  qu'une seule définition de « destinataire », partagée par les compteurs, la relance, l'export CSV et,
  plus tard, les envois push / e-mail.
- **Conséquences** : les notifications restent insérées côté serveur uniquement ; la livraison push / e-mail
  et le digest (session 10) consomment la table `notifications` sans nouveau calcul de cible.

## ADR-0019 — Photos du cahier de vie normalisées côté serveur

- **Contexte** : les photos d'enfants sont des données sensibles (§9) ; les téléphones ajoutent des métadonnées
  EXIF (GPS, appareil) et des fichiers de plusieurs Mo.
- **Décision** : chaque image passe par `lib/media.ts` (sharp) dans la Server Action : rotation automatique,
  1600 px maximum, ré-encodage WebP (qui supprime toutes les métadonnées), blurhash pour l'affichage
  progressif. Le bucket `class-media` est privé, les URL sont signées par lot pour 10 minutes, et le tag d'un
  élève est refusé par le trigger SQL tant que le droit à l'image n'est pas signé. La compression côté client
  (canvas) pourra s'ajouter en session 13 pour économiser la bande passante mobile ; elle ne remplacera pas
  la normalisation serveur.
- **Conséquences** : `sharp` est une dépendance de production (déjà utilisée par `next/image`) ; les vidéos
  et PDF du cahier de vie restent à traiter (limite 25 Mo, pas de transcodage).

## ADR-0020 — Messagerie : Realtime `postgres_changes` et règles de contact en SQL

- **Contexte** : le brief exige une messagerie instantanée modérée (§4.3) sans serveur WebSocket dédié, et
  des règles strictes sur qui peut écrire à qui (parents ↔ enseignant / direction, jamais parent ↔ parent
  par défaut, guardians en lecture seule).
- **Décision** : les fils vivent dans `threads` / `thread_members` / `messages` ; le client s'abonne à
  Supabase Realtime (`postgres_changes` filtré sur `thread_id`), ce qui applique les RLS existantes à chaque
  événement. Les règles de contact sont des fonctions SQL (`can_direct_message`, `open_dm`,
  `ensure_class_threads`) appelées par les Server Actions : un même DM est réutilisé, les fils de classe sont
  créés à la demande et de façon idempotente. La messagerie parent ↔ parent est un module désactivé par école
  (`schools.modules->'messaging'->>'parentToParent'`). Les messages supprimés sont masqués (soft delete)
  pour conserver la trace de modération ; les pièces jointes passent par le bucket privé `messages` et des
  URL signées de 10 minutes.
- **Conséquences** : pas de présence ni d'indicateur « en train d'écrire » (Realtime Broadcast possible plus
  tard) ; les notifications de nouveaux messages arrivent en session 10 ; la publication Realtime doit être
  créée sur chaque environnement (elle l'est par la migration).

## ADR-0021 — Calendrier hébraïque calculé localement, flux ICS par jeton, RSVP en SQL

- **Contexte** : l'agenda doit afficher les fêtes juives, les horaires de Chabbat et la parachah (§7.5, §10),
  alimenter le mode Chabbat (§7.8), s'abonner depuis Google / Apple Calendar, et gérer jauge, liste d'attente
  et créneaux de bénévolat sans incohérence entre clients.
- **Décision** : `@hebcal/core` (+ `@hebcal/locales` pour le français) tourne côté serveur, sans appel réseau,
  avec un cache par année civile et les coordonnées de l'école (`schools.latitude / longitude / timezone`) ;
  les catégories (majeure, mineure, jeûne, veille, lendemain…) sont dérivées des drapeaux hebcal. Les vacances
  scolaires sont de simples événements `holiday` (pas de table dédiée), pré-remplis depuis data.gouv.fr. Le flux
  ICS est privé : un jeton aléatoire de 24 octets par utilisateur (`calendar_feeds`), résolu par des fonctions
  SQL `security definer` appelées avec la clé anonyme, régénérable à tout moment ; le fichier est écrit par
  `lib/calendar/ics.ts` (RFC 5545) sans dépendance. Les réponses passent exclusivement par `rsvp_event()`
  (date limite, capacité, liste d'attente promue dans l'ordre d'arrivée, guardians exclus) : la politique
  d'écriture directe sur `event_rsvps` est supprimée. Les rappels J-7 / J-1 sont une fonction idempotente
  réservée au service role, planifiée en session 10 avec le digest.
- **Conséquences** : un seul fuseau (`Europe/Paris`) est supposé pour les saisies de formulaire ; les
  horaires d'allumage utilisent la havdalah « nuit tombée » (8,5°) d'hebcal, réglable plus tard par école ;
  le flux ICS expose les événements à quiconque détient le jeton (d'où la régénération et l'absence de
  données d'autres familles dans le flux).
