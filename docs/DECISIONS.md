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
- **Conséquences** : les clés locales (`pnpm db:status`) vont dans `.env.local` ; le projet cloud
  `kesher-staging` (UE) est à créer explicitement (coût), voir questions ouvertes.

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
