# Déploiement : staging → production

## Environnements

| Environnement | Supabase                              | Vercel                     | Branche        |
| ------------- | ------------------------------------- | -------------------------- | -------------- |
| Local         | `supabase start` ou PostgreSQL 16     | `pnpm dev`                 | —              |
| Staging       | projet `kesher-staging` (`eu-west-3`) | previews par branche       | `claude/*`, PR |
| Production    | projet `kesher-prod` (`eu-west-3`)    | https://abracom.vercel.app | `main`         |

## Première mise en production

1. **Supabase** : créer le projet (région Paris), noter l'URL et les clés. Deux façons d'appliquer les
   migrations : `scripts/ops/promote.sh <ref>` (CLI, mot de passe de base requis) ou
   `SUPABASE_ACCESS_TOKEN=… scripts/ops/apply-migrations.sh <ref> [--seed]` (API de gestion, jeton
   d'accès personnel seulement ; enregistre l'historique pour `supabase migration list`).
2. **Auth** : tout vit dans `supabase/config.toml` (inscription libre désactivée, TOTP, mot de passe ≥ 6
   caractères, modèles d'e-mails français de `supabase/templates/`). Pour l'appliquer au projet hébergé,
   ajouter un bloc de surcharge avec l'URL publique, puis `supabase config push` (proposé par
   `promote.sh`, ou par le workflow « Deploy database » si la variable `SUPABASE_CONFIG_PUSH` vaut `true`) :

   ```toml
   [remotes.staging]
   project_id = "<ref du projet, 20 caractères>"

   [remotes.staging.auth]
   site_url = "https://abracom.vercel.app"
   additional_redirect_urls = ["https://abracom.vercel.app/**", "https://abracom-*.vercel.app/**"]

   [remotes.staging.auth.email.smtp] # expéditeur Resend (facultatif tant que le SMTP par défaut suffit)
   enabled = true
   host = "smtp.resend.com"
   port = 465
   user = "resend"
   pass = "env(RESEND_API_KEY)"
   admin_email = "no-reply@example.org"
   sender_name = "Kesher"
   ```

   Sans ce bloc, régler à la main Site URL, redirections (`/auth/callback`, `/auth/confirm`) et modèles.
   Les modèles d'e-mails ne sont acceptés par l'offre gratuite qu'avec un expéditeur SMTP personnalisé :
   ils restent commentés dans `config.toml` jusque-là (l'API renvoie 400 sinon).

3. **Storage** : buckets privés `attachments`, `documents`, `class-media`, `avatars`, `justifications`,
   `messages` (créés par les migrations ; vérifier les politiques).
4. **Secrets Vault + pg_cron** : créer `kesher_site_url` et `kesher_cron_secret` dans Vault (tableau de
   bord, jamais dans l'éditeur SQL), puis exécuter `supabase/jobs/cron.sql` (dispatch toutes les
   5 minutes, digest horaire du soir, rappels et purge chaque matin). C'est le seul planificateur.
5. **Vercel** : variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, puis `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
   clés VAPID, Sentry (`pnpm ops:check-env --prod` après `vercel env pull`) ; branche de production `main`,
   région `cdg1`. Aucun cron Vercel : toute la planification vient de pg_cron (étape 4).
6. **Premier compte de direction** : `scripts/ops/create-account.sql` (psql ou éditeur SQL, mot de passe
   jamais committé — ADR-0028) ; la validation en deux étapes n'est demandée à la première connexion
   que si l'école l'exige (`modules.security.mfaRequired`, ADR-0030), à activer avant la production.
7. **Données réelles** : import CSV des familles depuis l'administration, puis invitations par lots.
   Ne jamais rejouer `seed.sql` en production.
8. **Vérifications** : `SMOKE_BASE_URL=https://… SMOKE_PASSWORD=… pnpm test:smoke` (connexion des comptes
   de démo et écrans principaux de chaque rôle), `pnpm perf https://…/connexion`, push de test depuis
   Notifications → Préférences, e-mail de test, un cycle complet annonce → accusé de lecture.

## Mise à jour

1. PR vers `main` avec CI verte (lint, types, build, e2e, base de données).
2. Les migrations partent **avant** le déploiement Vercel ; elles sont additives. Le workflow
   `.github/workflows/deploy-db.yml` s'en charge à chaque push sur `main` touchant `supabase/`, dès que
   le secret **`SUPABASE_ACCESS_TOKEN`** existe (jeton d'accès personnel Supabase, dans Settings →
   Secrets and variables → Actions). La référence du projet vient de `[remotes.*].project_id` dans
   `supabase/config.toml`, ou de la variable `SUPABASE_PROJECT_REF`. Aucun mot de passe de base n'est
   nécessaire : le workflow passe par l'API de gestion. Sans le secret, le job ne fait rien.
   La variable `SUPABASE_CONFIG_PUSH` à `true` ajoute la configuration Auth au même workflow.
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
