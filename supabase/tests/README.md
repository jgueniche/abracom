# Tests de base de données

## Tests RLS (pgTAP)

`supabase/tests/rls/*.sql` vérifie la matrice des rôles du brief (§5) contre le seed fictif :
anonyme, parent, parent séparé, guardian en lecture seule, guardian sous restriction judiciaire,
enseignant principal, enseignant spécialiste, secrétariat, direction, super admin — plus les règles
d'intégrité (année courante unique, droit à l'image obligatoire pour taguer une photo, RLS activée
sur toutes les tables).

Chaque fichier ouvre une transaction, se connecte « comme » un utilisateur via
`set_config('role', 'authenticated')` + `request.jwt.claims`, et termine par `rollback`.

## Deux façons de les exécuter

**Avec la stack Supabase (Docker)** — référence :

```bash
pnpm db:start          # supabase start
pnpm db:reset          # migrations + supabase/seed/*.sql
supabase test db       # exécute supabase/tests/**/*.sql avec pgTAP
```

**Sans Docker** — PostgreSQL 16 local (apt, Homebrew…) avec l'extension pgTAP :

```bash
sudo apt-get install postgresql-16 postgresql-16-pgtap
sudo -u postgres psql -c "CREATE ROLE kesher LOGIN SUPERUSER PASSWORD 'kesher';"
sudo -u postgres psql -c "CREATE DATABASE kesher_test OWNER kesher;"
pnpm db:test           # scripts/db/test-local.sh --seed
```

`scripts/db/test-local.sh` réinitialise la base, applique `supabase/tests/local/auth-shim.sql`
(un substitut minimal des schémas `auth` et `storage`, des rôles `anon` / `authenticated` /
`service_role` et des grants Supabase), puis les migrations, le seed et les tests. La CI
(`.github/workflows/ci.yml`, job `database`) fait exactement cela.

Le shim n'est **jamais** appliqué à un projet Supabase : il reproduit seulement ce que la plateforme
fournit déjà.

## Types TypeScript

- `pnpm db:types` : `supabase gen types` (stack Supabase requise).
- `pnpm db:types:local` : même résultat depuis un PostgreSQL local, via `@supabase/postgres-meta`
  (mis en cache dans `.cache/pgmeta`, ignoré par git).

## Identifiants du seed

Voir l'en-tête de `supabase/seed/seed.sql` : les identifiants sont déterministes
(`00000000-0000-4000-8000-<n sur 12 chiffres>` pour l'école, les classes, les annonces… ;
`c0000000-…-00000FFF00PP` pour les responsables de la famille FFF ; `d…` pour les élèves).
Comptes de démo : `admin@demo.local`, `staff@demo.local`, `teacher-ps@demo.local`,
`parent-1@demo.local`, `parent-en@demo.local` (mot de passe `demo-password`, développement uniquement).
