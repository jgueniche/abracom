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
