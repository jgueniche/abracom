#!/usr/bin/env bash
# Generates lib/supabase/database.types.ts from a plain PostgreSQL database without Docker
# (the Supabase CLI's `gen types --db-url` needs Docker). Uses @supabase/postgres-meta, the
# library behind the CLI, cached under .cache/pgmeta. With a Supabase stack available,
# prefer `pnpm db:types`.
#
#   scripts/db/gen-types-local.sh
#   KESHER_TEST_DB_URL=postgresql://... scripts/db/gen-types-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_URL="${KESHER_TEST_DB_URL:-postgresql://kesher:kesher@127.0.0.1:5432/kesher_test}"
CACHE=".cache/pgmeta"
VERSION="0.99.0"

if [[ ! -d "$CACHE/node_modules/@supabase/postgres-meta" ]]; then
  echo "▸ installing @supabase/postgres-meta@$VERSION into $CACHE"
  mkdir -p "$CACHE"
  (cd "$CACHE" && [[ -f package.json ]] || npm init -y >/dev/null)
  (cd "$CACHE" && npm install --no-audit --no-fund --loglevel=error "@supabase/postgres-meta@$VERSION")
fi

echo "▸ generating lib/supabase/database.types.ts from $DB_URL"
PG_META_DB_URL="$DB_URL" \
PG_META_GENERATE_TYPES=typescript \
PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=public \
PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS=true \
  node "$CACHE/node_modules/@supabase/postgres-meta/dist/server/server.js" > lib/supabase/database.types.ts 2>/dev/null
echo "▸ $(wc -l < lib/supabase/database.types.ts) lines"
