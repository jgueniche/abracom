# Kesher

Plateforme communautaire de l'École Abravanel (Neuilly-sur-Seine) : annonces officielles avec accusé de
lecture, espace classe, messagerie modérée, agenda (calendrier scolaire + fêtes juives), communauté et
administration simple. Nom de code provisoire (קשר, « lien »), renommable via `NEXT_PUBLIC_APP_NAME`.

> Point d'entrée pour toute contribution : [`CLAUDE.md`](./CLAUDE.md) (résumé du brief, conventions),
> [`docs/ROADMAP.md`](./docs/ROADMAP.md) (sessions) et [`docs/DECISIONS.md`](./docs/DECISIONS.md) (ADR).

## Prérequis

- Node.js 22 (`.nvmrc`), pnpm 10 (`corepack enable`)
- Docker (pour la stack Supabase locale, `pnpm db:start`)

## Démarrage

```bash
pnpm install
cp .env.example .env.local        # puis renseigner les clés Supabase (pnpm db:status)
pnpm dev                          # http://localhost:3000
```

## Base de données

```bash
pnpm db:start && pnpm db:reset   # stack Supabase locale (Docker) : migrations + seed
pnpm db:test                     # sans Docker : PostgreSQL 16 local + pgTAP (voir supabase/tests/README.md)
pnpm db:types:local              # régénère lib/supabase/database.types.ts depuis le PostgreSQL local
```

## Qualité

```bash
pnpm check        # lint + typecheck + format:check + tests unitaires
pnpm build        # build de production
pnpm test:e2e     # Playwright (mobile + desktop) ; CI=1 pour tester contre `next start`
```

## Scripts utilitaires

```bash
node scripts/brand/extract-palette.mjs        # couleurs dominantes du logo
node scripts/brand/check-contrast.ts          # contraste AA des tokens (les deux thèmes)
node scripts/brand/generate-icons.ts          # icônes PWA / favicon / apple-icon depuis le logo
node scripts/dev/screenshots.mjs http://127.0.0.1:3000 ./screenshots /dev/ui /   # captures mobile + desktop
```

```bash
pnpm perf [url]                               # audit Lighthouse mobile (seuil 90 avec STRICT=1)
pnpm ops:check-env --prod                     # variables d'environnement requises en production
pnpm ops:storage-sweep [--delete]             # objets de stockage orphelins (RGPD)
scripts/ops/promote.sh <ref>                  # migrations vers un projet Supabase cloud
psql "$DATABASE_URL" -v email=… -f scripts/ops/create-account.sql   # compte avec mot de passe et rôles (ADR-0028)
```

Le guide de style est disponible sur `/dev/ui` (développement et previews Vercel).

## Documentation

- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — sessions, état, questions ouvertes
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — décisions d'architecture (ADR)
- [`docs/RGPD.md`](./docs/RGPD.md) — registre, durées de conservation, exercice des droits
- [`docs/DEPLOIEMENT.md`](./docs/DEPLOIEMENT.md) — staging → production, exploitation
- [`docs/DEMO.md`](./docs/DEMO.md) — démo scénarisée de 15 minutes
- [`supabase/jobs/README.md`](./supabase/jobs/README.md) — notifications, cron
- Guides utilisateurs : `content/guides/*.md`, servis dans l'application (`/aide`) et en PDF

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript strict · Tailwind CSS v4 · shadcn/ui · next-intl
(fr / en) · next-themes · zod · Supabase (Postgres + RLS, Auth, Storage, Realtime) · Vitest · Playwright ·
GitHub Actions · Vercel (région `cdg1`).
