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

## ADR-0022 — Notifications : file en base, worker Next.js, mode Chabbat côté worker

- **Contexte** : le brief (§7.8) impose trois canaux (cloche, Web Push, e-mail), un digest à 18 h, des
  préférences fines et un mode Chabbat / fêtes qui met les envois en file. Le plan Vercel Hobby limite
  les crons à une exécution quotidienne et il n'y a pas de serveur de tâches.
- **Décision** : chaque notification in-app est la source de vérité ; un trigger SQL planifie les
  livraisons push / e-mail (`notification_deliveries`) d'après `effective_preference()`, si bien que la
  règle « jamais d'e-mail par message » et les préférences sont appliquées en base, quel que soit le
  producteur (Server Action, fonction SQL, futur import). Le fan-out du contenu publié est idempotent
  (`notified_at`) et déclenché à la fois par l'action de publication et par le worker. Le worker est une
  route Next.js protégée par `CRON_SECRET`, appelée par pg_cron + pg_net toutes les cinq minutes et par
  Vercel Cron pour les tâches quotidiennes ; il applique le mode Chabbat et les heures calmes avec
  `lib/hebcal` (coordonnées de l'école) en repoussant `scheduled_for`, envoie les push avec `web-push` et
  les e-mails via l'API REST de Resend, et supprime les abonnements expirés. Sans clés configurées, les
  livraisons restent en attente sans consommer de tentatives.
- **Conséquences** : latence maximale de cinq minutes pour le push (acceptable pour une école) ; le
  digest tourne deux fois (16 h et 17 h UTC) pour couvrir l'heure d'été et d'hiver ; les secrets du cron
  vivent dans Supabase Vault ; une Edge Function pourra remplacer la route si l'on quitte Vercel.

## ADR-0023 — Livret PDF rendu côté serveur, publication des évaluations par période

- **Contexte** : le brief demande une saisie « matrice » des compétences, une publication différée et un
  export PDF « livret » par élève (§7.3), sans notes chiffrées en maternelle et avec un score optionnel en
  élémentaire ; Vercel n'embarque pas de navigateur pour imprimer du HTML.
- **Décision** : le livret est décrit comme un document React (`lib/pdf/report-card.tsx`) rendu par
  `@react-pdf/renderer` dans une route Node (`/api/livret/[studentId]`), avec les polices standard (pas de
  fichier de police à embarquer) et des libellés traduits par l'appelant ; le paquet est déclaré
  `serverExternalPackages`. Les données passent par le client Supabase de session : la RLS garantit qu'une
  famille n'obtient que les évaluations publiées et visibles, l'équipe voit aussi les brouillons (mention
  explicite). La publication est une fonction SQL par classe et période (`publish_assessments`) qui rend
  visibles toutes les cases saisies, notifie une fois les responsables autorisés et journalise ; les cases
  ajoutées après publication attendent la publication suivante. Les appréciations générales vivent dans une
  table dédiée (`assessment_remarks`) liée à la période, visible aux mêmes conditions que les évaluations.
- **Conséquences** : le PDF est généré à la demande (pas de stockage, donc pas de rétention à gérer) ; les
  scores restent limités à `/20` dans l'interface ; le commentaire par compétence existe en base mais n'est pas
  saisi dans la matrice pour l'instant.

## ADR-0024 — Communauté : opt-in et modération garantis par la base, un RDV par famille

- **Contexte** : l'annuaire et les petites annonces exposent des données de familles entre elles (§7.6,
  §9) ; la modération a priori et le « un seul rendez-vous par famille » ne doivent pas dépendre du client.
- **Décision** : rien n'est visible sans opt-in explicite (`directory_optins`, faux par défaut) et les
  lectures passent par des fonctions `security definer` qui n'exposent que les champs cochés
  (`class_directory`, `classified_contact`) aux personnes ayant accès à la classe ou à l'école. Le trigger
  `guard_community_post` force le statut `pending` pour tout non-membre de l'équipe (réglage
  `schools.modules.marketplace.moderation = "none"` pour publier directement), interdit à l'auteur de changer
  le statut autrement que pour retirer son annonce, renvoie en modération toute modification d'une annonce
  publiée et borne l'expiration à trente jours. Les réservations de rendez-vous passent exclusivement par
  `book_appointment` (verrou de ligne, créneau libre et à venir, enfant inscrit dans la classe, une seule
  réservation à venir par famille — via `students.family_id` — et par classe) ; les familles ne voient jamais
  qui a réservé les autres créneaux, seule l'équipe obtient les noms (`class_appointments`).
- **Conséquences** : la messagerie parent ↔ parent reste fermée par défaut (ADR-0020), le contact se fait
  par les coordonnées partagées ; les rappels d'anniversaire ne partent que pour les enfants dont un
  responsable a coché l'option ; les formulaires dynamiques restent volontairement simples (sept types de
  champs, pas de logique conditionnelle).

## ADR-0025 — PWA sans mise en cache des pages privées, recherche en SQL sous RLS

- **Contexte** : l'application doit être installable et supporter les coupures réseau (§8), mais elle
  affiche des données de mineurs sur des appareils partagés ; la recherche globale doit respecter la
  matrice des rôles sans dupliquer la logique côté serveur.
- **Décision** : le service worker (écrit à la main, sans bibliothèque) ne met jamais de page HTML en cache :
  les navigations vont au réseau et basculent sur `/hors-ligne` en cas d'échec ; seuls les assets immuables
  (`/_next/static`, icônes, manifest) sont servis cache-first. Les push restent gérés par le même worker.
  La recherche est une fonction SQL `security invoker` qui unit les colonnes `search` (tsvector français
  sans accents) des tables existantes : chaque branche est filtrée par les politiques RLS de sa table,
  donc une recherche ne peut rien révéler de plus que les pages elles-mêmes. Les mesures de qualité sont
  outillées plutôt qu'affirmées : axe-core en e2e (WCAG 2.1 AA) et un script Lighthouse mobile.
- **Conséquences** : pas de lecture hors ligne des contenus (à ajouter plus tard avec un cache borné et
  chiffré si le besoin est confirmé) ; la recherche ignore les pièces jointes et le contenu des PDF ; les
  scores Lighthouse des pages connectées se mesurent sur le déploiement, pas en CI.

## ADR-0026 — Suppression par anonymisation, rétention en SQL, 2FA imposée à la direction

- **Contexte** : l'école reste responsable des dossiers scolaires même après le départ d'un parent de la
  plateforme ; les durées de conservation doivent s'appliquer sans intervention humaine ; la direction
  accède à des données sensibles depuis des appareils personnels.
- **Décision** : la suppression de compte anonymise le profil, retire liens, abonnements, réponses et
  coordonnées, vide les messages et suspend les rattachements, puis supprime le compte d'authentification ;
  les traces d'audit sont conservées sans données personnelles. Les durées de conservation vivent dans
  une seule fonction `purge_expired_data()` réservée au service role et planifiée chaque nuit, avec la règle
  scolaire « année en cours + 1 an » calculée sur la date de départ. La validation en deux étapes utilise
  le TOTP de Supabase Auth : facultative pour tous, obligatoire pour `school_admin` (redirection vers
  l'inscription, actions administratives refusées sans AAL2), non désactivable par la direction elle-même.
  La CSP est construite à chaque requête avec un nonce et `strict-dynamic`, ce qui interdit tout script
  tiers non déclaré. Sentry ne reçoit aucune donnée personnelle et reste inactif sans DSN.
- **Conséquences** : un parent supprimé peut être réinvité (nouveau compte) ; les objets du stockage
  orphelins nécessitent un balayage séparé ; le mode développement relâche la CSP (`unsafe-eval`,
  WebSocket HMR) mais jamais la production.

## ADR-0027 — Promotion de niveau en une transaction SQL, guides versionnés en Markdown

- **Contexte** : la bascule d'année touche toutes les classes, inscriptions et élèves à la fois ; une
  panne à mi-chemin laisserait l'école dans un état incohérent. Les guides doivent être lisibles dans
  l'application, imprimables et faciles à corriger par une personne non technique.
- **Décision** : la promotion est une fonction `security definer` réservée à la direction qui applique la
  correspondance classe → niveau cible fournie par l'assistant (nom de classe modifiable, « quitte
  l'école » pour la fin de cursus), inscrit les élèves actifs à la date de rentrée, clôture les
  inscriptions passées, archive les classes et bascule l'année courante dans une seule transaction
  journalisée ; les enseignants ne sont volontairement pas recopiés. Les guides sont des fichiers Markdown
  du dépôt (`content/guides`), rendus par le même composant que les annonces et convertis en PDF à la
  demande à partir de leur plan (titres, paragraphes, puces), sans dépendance supplémentaire.
- **Conséquences** : la promotion ne se rejoue pas (les classes de l'année cible existantes sont
  réutilisées par nom) ; les guides n'existent qu'en français pour l'instant et n'embarquent pas de
  captures d'écran.

## ADR-0028 — Connexion par mot de passe en complément du lien magique

- **Contexte** : les comptes de démonstration (`*@demo.local`) n'ont pas de boîte mail ; l'expéditeur
  par défaut de Supabase ne livre qu'aux membres de l'organisation et à un rythme limité ; le porteur
  doit pouvoir tester depuis un téléphone avant qu'un SMTP soit configuré. Le dépôt est public : le mot
  de passe du seed local est donc connu de tous.
- **Décision** : la page de connexion propose, derrière un bouton secondaire, une connexion par mot de
  passe (`signInWithPassword`). Le lien magique reste la voie par défaut et la seule proposée aux familles
  invitées. Aucune inscription libre ni réinitialisation en libre-service : un mot de passe n'existe que
  s'il a été attribué (seed local, `scripts/ops/create-account.sql`) et le lien magique sert de secours.
  La validation en deux étapes de la direction s'applique de la même manière après un mot de passe.
- **Conséquences** : sur tout environnement public, les comptes de démonstration reçoivent un mot de
  passe distinct de celui du seed ; la politique de mot de passe est celle de Supabase Auth (longueur
  minimale à relever dans le tableau de bord) ; une réinitialisation par e-mail pourra être ajoutée
  quand l'expéditeur transactionnel sera en place.

## ADR-0029 — Durcissement après revue : 2FA exigée par les politiques, fils fermés, contacts séparés

- **Contexte** : revue de sécurité croisée du 2026-09-08 (SQL / RLS, actions serveur, notifications et
  PWA, pages) avant la mise en service sur une base réelle. Elle a relevé des auto-promotions possibles
  dans la messagerie, des fonctions d'aide appelables sans session, un droit `can_message` jamais
  appliqué, des colonnes de modération et de rattachement modifiables par le client, un journal d'audit
  ouvert en écriture à tout membre et des données de contact lisibles par des tiers.
- **Décision** : (1) `has_school_role` n'accorde les droits de direction et de super administration qu'à
  une session en validation en deux étapes (`aal2`) ; les autres rôles ne sont pas concernés et les
  droits évalués pour un autre utilisateur (diffusion, déclencheurs) ne le sont pas non plus. (2) Les
  fonctions qui listent les identifiants d'un utilisateur ne répondent que sur l'appelant, sur les
  membres de son école pour l'équipe, dans les déclencheurs et pour le service ; plus aucune fonction du
  schéma `public` n'est exécutable anonymement, hormis le flux ICS. (3) Un modérateur est un membre
  explicitement désigné ou l'équipe de l'école ; un message direct reste à deux ; l'appartenance à un fil
  de classe suit l'accès courant à la classe (restriction judiciaire, départ) et le droit `can_message`
  de chaque responsable ; colonnes de modération, auteurs, écoles et rattachements sont figés par
  déclencheurs ; les événements et évaluations sont revalidés à la modification. (4) Le journal d'audit
  n'est alimenté que par `log_audit`, qui impose l'acteur et le rôle. (5) Le téléphone vit dans
  `profile_contacts` (soi-même, équipe, enseignants de l'enfant) et le motif d'une restriction dans
  `guardian_restrictions` (direction seule). (6) Les membres d'un même fil voient leurs noms.
- **Conséquences** : un administrateur doit activer la validation en deux étapes avant toute action, y
  compris par l'API ; les tests pgTAP se connectent avec la revendication `aal2` ; une inscription
  ouverte par élève et par année est garantie par index ; la messagerie parent ↔ parent reste
  désactivée par défaut ; les privilèges par défaut du schéma `public` n'accordent plus rien à `anon`
  ni à `PUBLIC`, donc **toute nouvelle fonction doit recevoir explicitement `grant execute … to
authenticated, service_role`** ; les invités voient le nom de l'école qui les invite ; les enseignants
  peuvent être affectés avant d'avoir accepté leur invitation ; 305 assertions pgTAP couvrent ces
  règles (`011_hardening.sql`).

## ADR-0030 — Validation en deux étapes optionnelle par école pendant la recette

- **Contexte** : le porteur veut une authentification minimale pour la phase de recette (comptes de test,
  mot de passe, aucune confirmation par e-mail) avant de durcir. La double authentification obligatoire
  pour la direction (ADR-0026, ADR-0029) bloquait ce parcours.
- **Décision** : l'exigence devient une option par établissement, `modules.security.mfaRequired`
  (défaut : désactivée), lue à la fois par `mfa_required()` dans les politiques RLS et par
  `mfaRequiredFor()` dans l'application. L'inscription TOTP reste possible pour tout le monde et une
  personne inscrite doit toujours saisir son code à chaque session ; le super administrateur n'est pas
  soumis à l'option. Les inscriptions libres restent fermées et les comptes sont confirmés d'office.
- **Conséquences** : avant la mise en production réelle, activer l'option pour l'école (`update
public.schools set modules = modules || '{"security": {"mfaRequired": true}}'`) ; la direction devra
  alors s'inscrire avant tout accès administrateur.

## ADR-0031 — Refonte de l'interface : charte « Papier & Grenat », navigation par rôle, anatomie unique

- **Contexte** : audit UI/UX du 2026-09-09 sur la version déployée (164 fichiers d'interface, 26 captures
  des trois rôles en 390 px et 1440 px). Quatre constats chiffrés : un unique `max-w-5xl` plafonnait
  toutes les pages connectées à 1 024 px et le dépôt ne contenait aucune règle `xl:`/`2xl:` (48 % d'un
  écran 1 920 px sans rien) ; l'en-tête empilait ~1 200 px de contenu dans 992 px, ce qui comprimait la
  cloche et l'avatar sous les 44 px tactiles ; 43 % des jetons de couleur ne peignaient aucun pixel et
  carte sur fond valait 1,04:1 ; une conversation montrait 24 % de messages pour 404 px de chrome, avec
  cinq boutons libellés sous chacun d'eux. Les annonces — objectif produit n° 1, porteur de l'accusé de
  lecture — n'étaient un onglet pour personne : elles vivaient dans une carte « Mon compte », sous « Plus ».
- **Décision** : (1) **Charte** — thème clair « Papier & Grenat » (papier chaud, sarcelle du logo en
  primaire, brique du logo en accent) et thème sombre « Nuit Sarcelle » (nuit sarcelle, or du mandala en
  primaire) ; les jetons morts `chart-*` et `sidebar-*` sont supprimés, `--brick`, `--success` et
  `--warning` sont ajoutés, Fraunces charge enfin ses axes `SOFT`/`WONK` et Source Serif 4 porte les
  textes institutionnels longs. (2) **Largeur** — plafond fluide `max-w-[110rem]` avec paliers
  `xl:`/`2xl:`, colonne latérale d'administration et messagerie en deux volets ; une variable
  `--nav-h` unique remplace `pb-24`, `bottom-16` et `bottom-20`. (3) **Navigation** — une barre par
  rôle, un onglet « École » qui réunit annonces, documents, agenda et formulaires, un pôle « Publier »
  pour les enseignants et la direction, un tableau de bord qui liste la file d'attente réelle, douze
  pastilles d'administration regroupées en quatre familles, « Plus » réduit au compte. (4) **Messagerie**
  — barre de conversation unique, groupage par auteur, actions au menu, séparateur « Nouveaux messages »,
  pagination remontante, recherche en surcouche. (5) **Contenus** — un `ContentCard` unique, un
  `EmptyState`, un `HubCard`, des monogrammes teintés déterministes.
- **Conséquences** : `tests/unit/design-tokens.test.ts` vérifie désormais aussi la séparation des plans
  (fond/carte ≥ 1,15:1) et le seuil non textuel de 3:1 des bordures de champ — le test précédent
  garantissait la lisibilité, jamais la hiérarchie, ce qui explique qu'une charte parfaitement conforme
  soit restée parfaitement fade. L'onglet « Fil » d'une classe disparaît (il rejouait Devoirs et Cahier),
  `/classes/[classId]` mène aux devoirs, `/classes` redirige quand il n'y a qu'une classe, et deux
  nouvelles routes existent : `/ecole` et `/publier`. Six bugs avérés sont corrigés au passage : composeur
  masqué par la barre d'onglets sur iPhone, bannière d'installation superposée, réactions dont on ne
  voyait jamais les siennes, recherche qui faisait disparaître le champ de saisie, « Vu par n » sans
  dénominateur, fil marqué lu sans être visible.

## ADR-0032 — Charte « Blanc & Techelet » : bleus et blanc plutôt que papier chaud

- **Contexte** : à la revue de la refonte (ADR-0031), le porteur a écarté le fond beige. Il veut une
  interface nettement plus pâle et une identité construite sur les couleurs d'Israël — des nuances de
  bleu et du blanc — plutôt que sur le papier chaud de la direction « Papier & Grenat ».
- **Décision** : le thème clair devient **« Blanc & Techelet »** — page quasi blanche
  `oklch(0.977 0.01 252.8)` (#f3f8fe), cartes **blanc pur**, primaire au bleu du drapeau
  `oklch(0.412 0.206 262.9)` (#0038b8). Le thème sombre devient **« Nuit Techelet »** — nuit marine
  #0a1524, plans #152740 et #203756, primaire bleu clair #8ab4ff. Le rouge brique du logo est conservé
  mais **uniquement pour ce qui attend le lecteur** (accusé de lecture dû, signalement) : il n'a plus
  aucun rôle décoratif. Le vert et l'ambre restent les couleurs fonctionnelles de succès et
  d'avertissement. Les icônes PWA sont régénérées sur le nouveau fond (`scripts/brand/generate-icons.ts`),
  et les teintes d'avatar sont recentrées sur les bleus.
- **Conséquences** : sur une page quasi blanche, un plan ne peut plus être dessiné par son fond — la
  séparation fond / carte tombe à 1,07:1. Les seuils de `tests/unit/design-tokens.test.ts` basculent donc
  du **fond vers la bordure** : le filet doit atteindre **1,55:1 vu de la carte** et **1,5:1 vu de la
  page** (il est à 1,65 et 1,55), et l'ombre porte le reste du relief. C'est le contraire du défaut
  d'origine, où la carte était à 1,04:1 **et** son filet à 1,35:1 : aucun des deux ne dessinait le plan.
  Le reste est inchangé : bordure de champ à 3,9:1, blanc sur primaire à 9,3:1, texte à 15,7:1. Les jetons de marque `--brand-*` restent les couleurs extraites du logo et ne changent pas ;
  seule leur mise en œuvre change. Les planches d'audit publiées (directions A / B / C) documentent la
  décision précédente et ne sont pas réécrites : cette ADR est la trace de l'arbitrage suivant.

## ADR-0033 — Le rôle de service est un contexte de requête, pas un rôle de connexion

- **Contexte** : `is_service_role()` répondait vrai dès que `session_user` valait `postgres` ou
  `supabase_admin`. Or `set role authenticated` ne change pas `session_user` : l'éditeur SQL de
  Supabase, une session psql d'exploitation et surtout `supabase test db` — la façon dont la suite
  pgTAP s'exécute sur la plateforme — étaient tous traités comme la clé de service. Rejouée sur une
  vraie stack Supabase (PostgreSQL 17, schémas `auth` et `storage` réels), la suite échouait sur sept
  assertions de durcissement : `may_inspect`, colonnes de modération, message pré-supprimé,
  auto-promotion en modérateur, déplacement d'un message, déclenchement du fan-out. En CI elles
  passaient, parce que la suite s'y connecte sous un rôle applicatif. Les garde-fous n'avaient donc
  jamais été vérifiés sur la plateforme de production. Une comparaison `current_user = session_user`
  ne suffit pas : dans une fonction `security definer`, `current_user` redevient le propriétaire.
- **Décision** : le privilège suit le **contexte de requête**. Une session qui porte un JWT
  utilisateur n'est « service » que si la revendication le dit ; une session qui n'en porte aucun
  (pg_cron, migrations, seed, psql d'exploitation) garde son privilège selon son rôle de connexion.
- **Conséquences** : les 336 assertions pgTAP passent à l'identique sur le shim de la CI et sur une
  stack Supabase réelle (`pnpm db:test:supabase`). Trois assertions nouvelles fixent la règle dans
  `011_hardening.sql`. Aucun changement pour PostgREST, qui se connecte en `authenticator` et n'a
  jamais bénéficié de l'échappatoire.

## ADR-0034 — Une seule inscription ouverte par élève

- **Contexte** : sept écrans lisent `enrollments[0]` — carte d'enfant, fiche famille, liste des
  classes, annuaire, pôle communauté — pendant que le cahier de texte parcourt toutes les inscriptions.
  L'index existant ne garantissait l'unicité que **par année scolaire**, et l'assistant de promotion
  ouvrait l'inscription de l'année suivante _avant_ de clore l'année courante : un élève en détenait
  donc légitimement deux, sans qu'aucun `order by` ne dise laquelle un parent verrait.
- **Décision** (arbitrage du porteur) : un élève appartient à **une classe à la fois**. Index unique
  partiel sur `enrollments (student_id) where left_on is null`.
- **Conséquences** : `promote_school_year` clôt d'abord et reporte les élèves par la clause
  `returning`, sinon l'index refuse l'insertion. `enrollments[0]` devient exact partout, et
  `002_integrity.sql` comme `009_promotion.sql` le vérifient. Un changement de classe en cours d'année
  se fait donc en deux temps : clore, puis inscrire.

## ADR-0035 — Import CSV et journal d'audit réservés à la direction

- **Contexte** : `docs/QA.md` demandait au secrétariat de réaliser l'import CSV, le code le réservait
  à `school_admin`, et les deux entrées « Import CSV » et « Journal » figuraient malgré tout dans la
  barre d'administration du secrétariat — d'où un renvoi silencieux vers l'accueil.
- **Décision** (arbitrage du porteur) : ces deux rubriques restent **réservées à la direction**. Elles
  ne sont plus dessinées pour les autres rôles (`adminGroupsFor`), et la recette est corrigée.
- **Conséquences** : le secrétariat garde dix rubriques sur douze. En contrepartie, la saisie d'absence
  lui est ouverte dans l'espace de classe — la politique `absences_insert` l'autorisait depuis toujours,
  seul le formulaire manquait, et c'est lui qui reçoit l'appel téléphonique des familles.

## ADR-0036 — L'onglet École sur le téléphone d'une enseignante, Publier au bureau

- **Contexte** : l'onglet « École » n'existait qu'à partir de `lg`. Sur téléphone, une enseignante
  n'atteignait ni les annonces, ni les circulaires, ni les formulaires, ni la communauté — le canal
  officiel direction → école, qui est l'objectif produit n° 1. Vérifié par parcours automatique de
  tous les liens visibles à 390 px : aucune route, à aucune profondeur.
- **Décision** : « École » entre dans les cinq onglets de l'enseignante ; « Publier » prend sa place
  dans la barre de bureau. Publier reste à un geste depuis l'accueil (« Nouveau devoir »), depuis
  l'espace de classe (« Nouvelle publication ») et depuis le cahier de texte.
- **Conséquences** : un responsable en lecture seule, qui n'a pas de messagerie, voit l'agenda à la
  place de l'onglet « Messages » — sa barre reste à cinq destinations utiles.

## ADR-0037 — Le dialogue parents → école est un robinet, pas un module

- **Contexte** : la directrice demande de pouvoir « ouvrir et fermer le dialogue ponctuellement, à sa
  convenance ». Le levier existait déjà en base — `threads.allow_replies`, `locked`, `archived` — mais
  n'était exposé nulle part comme une décision, et n'avait aucune notion de période. `parent_can_message`
  ne réglait que le droit **d'un responsable**, jamais celui de l'école.
- **Décision** : trois leviers, une table.
  1. Un mode d'école dans `schools.modules -> 'messaging' ->> 'parentToStaff'` :
     `open` | `closed` | `scheduled`, avec la liste des publics concernés (`closedScopes`) — la portée
     est choisie à chaque fois (arbitrage 2), de sorte qu'une fermeture des enseignants peut laisser le
     secrétariat comme porte de secours.
  2. `messaging_windows` : une période datée qui **ouvre** ou **ferme** un canal. « Ouvrir le mardi
     17 h – 19 h » et « fermer du 15 au 30 juin » sont le même objet avec un `kind` différent. Une
     période peut viser toute l'école, une classe, ou une seule personne de l'équipe.
  3. Le fil lui-même : `allow_replies`, enfin exposé comme un bouton lisible.
- **Application** : par les RLS, jamais par l'écran. `can_post_in_thread` — que la politique
  `messages_insert` appelle déjà — refuse l'INSERT quand le canal est fermé, et `can_direct_message`
  applique la même règle à l'ouverture d'une conversation, sinon un canal fermé serait à un
  « nouveau message » de distance. Trente assertions pgTAP couvrent école ouverte, école fermée,
  fenêtre en cours, fenêtre passée, période de fermeture, classe visée seule, et responsable
  individuellement bloqué ; chacune se termine sur un vrai INSERT dans `public.messages`.
- **Historique** (arbitrage 1) : une fermeture rend les fils **en lecture seule**. Rien ne disparaît de
  la liste : un parent qui cherche ce que la maîtresse a écrit en octobre le retrouve.
- **Ce que voit le parent** (arbitrage 4) : le composeur est remplacé par une phrase générique passée
  par next-intl, la date de réouverture **seulement si une période le dit** — on ne promet que ce qui est
  saisi — et le contact d'urgence tel que la direction l'a tapé dans les réglages. Aucun texte
  institutionnel n'est inventé.
- **« Heures de réponse »** : la phrase statique promettait 48 h ouvrés et rien ne l'appliquait. Elle
  disparaît, remplacée par `messaging_current_closing()` — la fin de la période d'ouverture en cours,
  affichée en aide du composeur. Ou c'est vrai, ou ça n'est pas là.
- **Conséquences** : les heures saisies sont lues à l'horloge de l'**école** (`schools.timezone`), pas à
  celle du navigateur ; une directrice en voyage saisit donc bien l'heure de Neuilly. `/admin/messagerie`
  montre l'état de chaque canal, un interrupteur par ligne, et la charge réelle (`messaging_load`,
  huit semaines, par classe et par enseignant) — sans ce chiffre la fermeture se déciderait à l'aveugle.
  Les périodes closes depuis plus d'un an sont purgées.

## ADR-0038 — Un enseignant peut rouvrir son canal malgré une fermeture d'école

- **Contexte** : la question se pose dès qu'il existe deux niveaux de décision. La rédaction initiale du
  chantier posait la fermeture d'école comme un plafond absolu.
- **Décision** (arbitrage 3 du porteur) : **oui, avec trace**. Un enseignant qui modère son fil peut y
  poser `settings -> 'overrideSchoolClosure'`, et les familles de sa classe écrivent de nouveau.
  L'action part dans `audit_log` (`thread.override`) et la dérogation apparaît sur l'écran de pilotage
  de la direction, qui peut la retirer d'un bouton.
- **Alternative écartée** : le plafond strict. Plus simple à retenir, mais il obligeait la directrice à
  rouvrir toute l'école pour le cas d'une classe en voyage.
- **Conséquences** : la fermeture d'école n'est pas une garantie technique, c'est un réglage par défaut
  que l'équipe peut lever **visiblement**. C'est l'écran de pilotage, pas la base, qui porte la
  responsabilité de le montrer — d'où la colonne `override` de `messaging_channels()` et l'assertion
  pgTAP qui la vérifie.

## ADR-0039 — La pointeuse : présence et remise de l'enfant, jamais la facturation

- **Contexte** : le brief initial classait « cantine et garderie » en **non-objectif du MVP**. La
  direction rouvre délibérément cette porte : elle veut pointer les enfants, d'abord au périscolaire.
  Rien n'existait — aucune table de pointage, de présence ni d'appel. Le plus proche, `absences`, est
  déclaratif et saisi par la famille ; `event_slots` et `appointment_slots` réservent des créneaux, ils
  ne constatent pas une présence.
- **Périmètre — ce qu'on fait** : constater une présence, une arrivée, un départ, et **qui récupère
  l'enfant**. Trois natures de liste : l'appel de classe (`class_roll`), un service récurrent
  (`service` : périscolaire matin, périscolaire soir, cantine), une occasion (`occasional` : sortie,
  spectacle, événement de l'agenda).
- **Périmètre — ce qu'on ne fait pas** : facturation, tarification, prélèvement. Le modèle doit
  cependant pouvoir alimenter une facturation plus tard sans migration douloureuse : `attendance_lists`
  porte un `code` de service, `attendance_sessions` une date, et `attendance_records` l'heure d'arrivée
  et l'heure de départ. Une facturation future joint sur (session, élève) et calcule ses durées ; elle
  n'a rien à ajouter au registre de présence.
- **Récurrence** : jours de la semaine + plage de dates, pas de moteur de récurrence. Une occurrence
  (`attendance_sessions`) est créée à la demande, le jour où l'on pointe, et vérifiée contre la
  récurrence de la liste. Une occurrence hors récurrence reste possible (rattrapage), et elle est datée.
- **Qui pointe** : aucun rôle nouveau. `school_admin` partout dans son école ; les enseignants sur
  l'appel de leur propre classe ; et pour tout le reste une table de responsables **liste par liste**
  (`attendance_list_managers`), pour qu'une animatrice du soir n'hérite pas des droits du secrétariat.
  Le secrétariat n'est pas responsable d'office : on l'ajoute à une liste comme n'importe qui.
- **Le point de sécurité** : `attendance_records.pickup_user_id` ne peut désigner qu'un responsable
  autorisé de **cet** élève. Un responsable sous restriction judiciaire (`student_guardians.access_blocked`)
  n'est jamais proposé et ne peut pas être saisi — un déclencheur le refuse en base, et une assertion
  pgTAP le vérifie explicitement. Toute correction a posteriori d'un pointage part dans `audit_log`.
- **Arbitrages du porteur** :
  - **5. Visibilité famille** : le parent voit l'arrivée et le départ de son enfant **au périscolaire et
    en sortie seulement**. L'appel de classe reste interne à l'équipe : la présence en classe visible en
    direct, c'est de la surveillance scolaire, et chaque retard deviendrait une notification. Porté par
    `attendance_lists.visible_to_guardians`, appliqué par les RLS.
  - **6. Qui récupère** : enregistré au périscolaire et en sortie, pas à l'appel
    (`attendance_lists.records_pickup`). Une tape par enfant à l'appel est la condition pour qu'il soit
    réellement utilisé.
  - **7. Conservation** : **12 mois glissants**, purgés par `purge_expired_data()` — l'année scolaire
    écoulée et un éventuel litige de facturation périscolaire.
  - **8. Lien avec les absences** : les deux registres restent **indépendants en écriture**. La liste de
    pointage affiche « annoncé absent » pour les enfants déclarés par leur famille, pour que la personne
    qui pointe ne les cherche pas ; elle ne crée jamais d'absence à justifier sur une saisie oubliée.
- **Hors ligne** : le hall d'entrée n'a pas de wifi fiable. Les pointages sont mis en file dans le
  navigateur (`localStorage`) et rejoués par la même Server Action au retour du réseau, avec un
  compteur honnête. Un pointage perdu est pire qu'un pointage lent. La file est **par occurrence**, et
  chaque entrée porte son horodatage local : c'est l'heure de la tape qui fait foi, pas celle de l'envoi.

## ADR-0040 — Emploi du temps : une grille hebdomadaire, pas un moteur d'horaires

- **Contexte** : premier des trois écarts avec Educartable retenus en session 19. Rien n'existait.
  La tentation est de modéliser les semaines A/B, les demi-groupes, les remplacements et les salles
  partagées ; une école de six classes n'en a pas besoin, et chacun de ces cas est une source de saisie
  quotidienne que personne ne tiendra à jour.
- **Décision** : `class_timetable` décrit **une semaine type** — jour ISO, deux heures, une matière,
  éventuellement un intervenant et une salle. Les exceptions (sortie, spectacle, remplacement) vivent
  déjà dans l'agenda, qui les notifie ; l'emploi du temps répond à « à quoi ressemble un mardi ».
- **Conséquences** : la grille se lit comme une **liste de jours**, pas comme un tableau croisé
  heures × jours — illisible à 390 px, et inutile pour une semaine aussi courte. Une politique
  d'écriture réservée à l'équipe de la classe et au secrétariat, et un `with check` qui refuse de
  nommer un intervenant qui n'enseigne pas dans cette classe. Le `weekday` accepte le dimanche sans
  l'imposer : c'est un jour d'école en Israël, pas à Neuilly, et le schéma ne tranche pas pour l'école.

## ADR-0041 — Un mot d'excuse signé soumet une justification, il ne l'accorde pas

- **Contexte** : deuxième écart. Les deux briques existaient depuis des mois sans avoir été présentées
  l'une à l'autre : `absences` portait une déclaration et un justificatif scanné, `document_signatures`
  une signature électronique horodatée. Le manque était qu'une famille doive imprimer, signer, scanner.
- **Décision** : `absence_justifications` — le texte de la famille, le nom tapé au moment de signer,
  l'horodatage, l'IP et le navigateur. `declare_and_sign_absence()` écrit l'absence et son mot **dans la
  même transaction** : un mot sans son absence, ou l'inverse, est pire que ni l'un ni l'autre.
- **La frontière** : signer **soumet** une justification, cela ne l'**accorde** pas. `absences.status`
  reste hors de portée de la famille, comme le durcissement de la session 15 l'a établi, et l'école
  décide en lisant le mot. Une assertion pgTAP fixe la règle.
- **Conséquences** : le déclencheur `stamp_absence_justification` impose `user_id` et `signed_at`
  côté base — `document_signatures` fait confiance à sa Server Action pour les deux, ce qui laisse une
  écriture PostgREST directe libre d'antidater un mot ; celui-ci ne peut pas être menti. Aucune
  politique d'`update` : une signature est un fait, elle ne se réécrit pas ; seule la direction peut en
  supprimer une, pour un mot déposé par erreur. Le justificatif scanné reste possible, en complément.

## ADR-0042 — Les retards : une addition, pas une collecte

- **Contexte** : troisième écart. Deux registres tenaient déjà la réponse et personne ne les avait
  additionnés — ce que la famille déclare (`absences.kind = 'late'`) et ce que la pointeuse constate
  (`attendance_records.status = 'late'`, ou une arrivée après l'heure d'ouverture de la liste).
- **Décision** : `late_report()` additionne les deux et les garde **distincts** à l'écran. Un même
  retard peut figurer dans les deux colonnes, et l'écran le dit plutôt que de dédupliquer à l'aveugle :
  une famille qui prévient et un enfant qui arrive en retard sont deux faits, pas un doublon.
- **Portée** : la lecture par classe est ouverte à l'équipe de cette classe ; la lecture de toute
  l'école est réservée au secrétariat et à la direction. Une famille n'y accède jamais — c'est une
  lecture transversale, pas une information sur son enfant.
- **Conséquences** : aucune table nouvelle, aucune donnée nouvelle. L'heure de comparaison est lue à
  l'horloge de l'école (`school_timezone`), sinon un service ouvrant à 8 h 30 compterait tout le monde
  en retard deux heures durant l'été.
