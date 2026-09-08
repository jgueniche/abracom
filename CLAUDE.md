# Kesher — plateforme communautaire de l'École Abravanel

> Résumé exécutif du brief produit. Le brief complet fait foi ; ce fichier est le point d'entrée
> de toute session de travail. Mettre à jour la section « État d'avancement » à chaque fin de session.

## 1. Contexte en 10 lignes

- **École Abravanel** (Neuilly-sur-Seine, second site Levallois-Perret) : maternelle + élémentaire,
  école juive privée bilingue FR/EN. Groupe « Les Institutions Abravanel ».
- **Problème** : communication direction → parents et enseignants → parents dispersée (e-mail,
  Educartable), pas de suivi devoirs / évaluations / infos de classe, pas d'espace communautaire.
- **Kesher** (קשר, « lien ») = nom de code, renommable via `NEXT_PUBLIC_APP_NAME`.
- **Porteur** : parent d'élèves (médecin, entrepreneur, culture RGPD). Projet bénévole.
  Doit être démontrable à la direction rapidement, puis extensible.
- **Périmètre initial** : site de Neuilly, mais **multi-établissement dès le schéma** (`school_id` partout).
- **Non-objectifs MVP** : facturation, cantine, garderie, appli native (PWA), remplacement d'Educartable.
- **MVP présentable = sessions 1–8** ; V1 complète = sessions 9–15 (voir `docs/ROADMAP.md`).

## 2. Objectifs produit (ordre de priorité)

1. Canal officiel direction → parents (annonces, circulaires, documents) avec **accusé de lecture**.
2. Espace classe enseignant → parents : devoirs, cahier de vie (photos), évaluations par compétences, mots individuels.
3. Messagerie parents ↔ enseignant / direction, modérée, fils par classe, temps réel.
4. Agenda : calendrier scolaire + **fêtes juives (hebcal)**, événements, RSVP, bénévolat, ICS.
5. Communauté : groupes de classe, annuaire opt-in, entraide, anniversaires.
6. Administration simple pour une directrice non technique : classes, affectations, import CSV, promotion de niveau.

## 3. Stack imposée

Next.js 15 (App Router, RSC, Server Actions, TS strict, pnpm) · Tailwind v4 + shadcn/ui + lucide
(+ framer-motion avec parcimonie) · Supabase (Postgres, Auth magic link + invitations, Storage privé,
Realtime, Edge Functions) avec **RLS obligatoire sur toutes les tables** · migrations SQL versionnées
(`supabase/migrations`, pas de Prisma) · next-intl (`fr` défaut, `en`) · next-themes · zod partout ·
@hebcal/core · Web Push + Resend + digest (pg_cron) · Vitest / Playwright / tests RLS · Vercel (`cdg1`)

- Supabase cloud UE · ESLint / Prettier / Husky / Conventional Commits · Sentry.

## 4. Commandes

| Commande                                  | Rôle                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                | Serveur de dev (Turbopack) sur http://localhost:3000                      |
| `pnpm build` / `pnpm start`               | Build et serveur de production                                            |
| `pnpm check`                              | lint + typecheck + format:check + tests unitaires (ce que fait la CI)     |
| `pnpm lint` / `pnpm lint:fix`             | ESLint (config Next + TS + Prettier)                                      |
| `pnpm typecheck`                          | `tsc --noEmit`                                                            |
| `pnpm format` / `pnpm format:check`       | Prettier (plugin Tailwind)                                                |
| `pnpm test` / `pnpm test:watch`           | Vitest (`tests/unit`)                                                     |
| `pnpm test:e2e`                           | Playwright (`tests/e2e`, projets mobile + desktop). `CI=1` ⇒ `next start` |
| `pnpm db:start` / `db:stop` / `db:status` | Stack Supabase locale (**Docker requis**)                                 |
| `pnpm db:reset`                           | Rejoue migrations + `supabase/seed/*.sql`                                 |
| `pnpm db:types`                           | Génère `lib/supabase/database.types.ts`                                   |

Variables d'environnement : copier `.env.example` vers `.env.local`. Sans Supabase configuré,
l'app démarre quand même (session 1) ; les clients Supabase lèvent une erreur explicite à l'usage.

## 5. Structure du dépôt

```
app/            routes App Router : (auth) (parent) (teacher) (admin) (public), dev/ui
components/     ui/ (shadcn, généré) · domain/ (PostCard, AnnouncementCard…) · layouts/
lib/            supabase/ (client, server, admin) · auth/ · permissions/ · hebcal/ · notifications/ · i18n/ · env.ts
server/         actions/ (zod + rôle) · queries/ · jobs/
supabase/       config.toml · migrations/ · seed/ · functions/ (edge, Deno) · tests/rls/
messages/       fr.json · en.json (mêmes clés, test de parité dans tests/unit/i18n.test.ts)
tests/          unit/ (Vitest) · e2e/ (Playwright)
docs/           ROADMAP.md · DECISIONS.md (ADR) · RGPD.md · guides (sessions 14–15)
```

## 6. Conventions (non négociables)

- **Server Actions pour toute mutation** : `zod` → vérification de rôle via `lib/permissions` →
  requête → `revalidatePath` → `audit_log` si action admin / modération.
- **Aucune autorisation côté client seul** ; les RLS reproduisent la matrice des rôles (§5 du brief)
  via `can_access_class(user_id, class_id)` et `can_access_student(user_id, student_id)`.
- Aucun accès `service_role` côté client ; `lib/supabase/admin.ts` est `server-only`.
- Composants serveur par défaut ; `"use client"` uniquement pour l'interactivité.
- **Aucune chaîne en dur** : tout libellé passe par `next-intl` (`messages/fr.json` + `messages/en.json`).
- Nommage : BDD `snake_case`, TS `camelCase`, composants `PascalCase`. Code, commits, variables en anglais ;
  UI en français par défaut.
- Messages d'erreur utilisateur en français, jamais de stack trace.
- Mobile-first, tailles tactiles ≥ 44 px (`min-h-11` / `size-11`), WCAG AA, dark mode.
- Commits **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`…), vérifiés par commitlint.
- Chaque PR : description, captures mobile, checklist RLS si nouvelle table.

## 7. Rôles (rappel)

`super_admin` (plateforme) · `school_admin` (direction) · `staff` (secrétariat, pas d'accès aux évaluations)
· `teacher` (`main` / `assistant` / `specialist` par classe) · `parent` (via `student_guardians`) ·
`guardian` (lecture seule, ni évaluations ni messagerie). Un utilisateur peut cumuler des rôles.
Toute visibilité d'enfant passe par `student_guardians` + `enrollments`.

## 8. Sécurité & RGPD (données de mineurs)

Hébergement UE uniquement (Supabase `eu-west`/`eu-central`, Vercel `cdg1`, Resend UE) · pas de trackers
tiers · photos en bucket privé, URL signées 10 min, tag d'élève bloqué sans droit à l'image signé ·
familles séparées (droits indépendants, flag « restriction judiciaire ») · export / suppression de compte ·
2FA admin · CSP stricte + HSTS (session 14) · audit log sur toute action admin et modération ·
durées de conservation dans `docs/RGPD.md` (session 14).

## 9. Mode opératoire

1. Travailler **session par session** (`docs/ROADMAP.md`) : un incrément déployable, testé, committé.
   Ne pas commencer la V2 avant validation du MVP.
2. Décision structurante non couverte par le brief : poser la question **avant** d'implémenter, sinon
   choisir l'option la plus simple et la consigner dans `docs/DECISIONS.md` (ADR court).
3. **Ne jamais fabriquer de contenu institutionnel** (textes de la direction, vrais noms d'enseignants) :
   données de seed clairement fictives (§14 du brief, comptes `*@demo.local`).
4. Avant de committer : `pnpm check` puis `pnpm build` ; e2e si l'UI change.
5. Mettre à jour `CLAUDE.md` (état) et `docs/ROADMAP.md` (cases) à chaque fin de session.

## 10. État d'avancement

- **Session 1 — terminée** : bootstrap Next 15.5 + Tailwind v4 + shadcn (preset Nova/Radix) + next-intl
  - next-themes + zod, clients Supabase, `supabase/config.toml` (projet `kesher`), CI GitHub Actions
    (lint, types, format, unit, build, e2e), Husky + commitlint, tests unitaires (9) et e2e (8) verts,
    `vercel.json` (région `cdg1`), projet Vercel `abracom` importé depuis GitHub (production :
    https://abracom.vercel.app, previews par branche). **Reste** : vérifier `supabase start` sur un poste
    avec Docker ; créer le projet Supabase cloud `kesher-staging` (UE) avant la session 3.
- **Prochaine session — 2** : identité visuelle (téléchargement du logo, extraction de palette, tokens
  `primary` / `accent` / `surface` / `muted`, typographies Inter + serif, page `/dev/ui`, icônes PWA).
- Le schéma BDD n'a **pas** été commencé (session 3), conformément au brief.
- Questions ouvertes (§15 du brief) : voir `docs/ROADMAP.md`, section « Questions ouvertes ».
