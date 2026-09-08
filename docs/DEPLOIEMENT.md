# Déploiement : staging → production

## Environnements

| Environnement | Supabase                              | Vercel                     | Branche        |
| ------------- | ------------------------------------- | -------------------------- | -------------- |
| Local         | `supabase start` ou PostgreSQL 16     | `pnpm dev`                 | —              |
| Staging       | projet `kesher-staging` (`eu-west-3`) | previews par branche       | `claude/*`, PR |
| Production    | projet `kesher-prod` (`eu-west-3`)    | https://abracom.vercel.app | `main`         |

## Première mise en production

1. **Supabase** : créer le projet (région Paris), noter l'URL et les clés. `scripts/ops/promote.sh <ref>`
   applique les migrations ; vérifier `supabase migration list`.
2. **Auth** : Site URL = URL publique, redirections `https://…/auth/callback` et `/auth/confirm`,
   inscription libre désactivée, TOTP MFA activé, expéditeur e-mail (SMTP Resend) et modèles en français.
3. **Storage** : buckets privés `attachments`, `documents`, `class-media`, `avatars`, `justifications`,
   `messages` (créés par les migrations ; vérifier les politiques).
4. **Secrets Vault + pg_cron** : `supabase/jobs/cron.sql` (dispatch toutes les 5 minutes, digest, rappels,
   purge de rétention).
5. **Vercel** : variables (`pnpm ops:check-env --prod` après `vercel env pull`), branche de production
   `main`, région `cdg1`, crons de `vercel.json` actifs (plan Hobby : quotidiens).
6. **Premier compte de direction** : `scripts/ops/create-account.sql` (psql ou éditeur SQL, mot de passe
   jamais committé — ADR-0028) ; la validation en deux étapes est demandée à la première connexion.
7. **Données réelles** : import CSV des familles depuis l'administration, puis invitations par lots.
   Ne jamais rejouer `seed.sql` en production.
8. **Vérifications** : `pnpm perf https://…/connexion`, push de test depuis Notifications → Préférences,
   e-mail de test, un cycle complet annonce → accusé de lecture.

## Mise à jour

1. PR vers `main` avec CI verte (lint, types, build, e2e, base de données).
2. `supabase db push` (via `scripts/ops/promote.sh <ref>`) **avant** le déploiement Vercel si la version
   ajoute des migrations ; les migrations sont additives.
3. Déploiement Vercel automatique sur `main` ; surveiller Sentry pendant une heure.

## Sauvegardes et retour arrière

- Supabase : sauvegardes quotidiennes, PITR selon le plan ; tester une restauration sur le projet staging
  avant la rentrée.
- Vercel : « Promote » d'un déploiement précédent pour revenir en arrière côté application (les
  migrations restant compatibles).

## Exploitation récurrente

| Quand       | Quoi                                                     | Comment                           |
| ----------- | -------------------------------------------------------- | --------------------------------- |
| Chaque nuit | Purge de rétention                                       | pg_cron (`purge_expired_data`)    |
| Chaque mois | Objets de stockage orphelins                             | `pnpm ops:storage-sweep --delete` |
| Juillet     | Promotion de niveau et archivage de l'année              | Administration → Années           |
| Rentrée     | Import CSV, invitations, vérification du droit à l'image | Administration                    |
