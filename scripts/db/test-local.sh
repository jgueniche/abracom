#!/usr/bin/env bash
# Applies the migrations (and optionally the seed) to a throw-away local PostgreSQL
# database with a Supabase shim, then runs the pgTAP RLS tests.
#
#   scripts/db/test-local.sh              # migrations + tests
#   scripts/db/test-local.sh --seed       # migrations + seed + tests
#   KESHER_TEST_DB_URL=postgresql://... scripts/db/test-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_URL="${KESHER_TEST_DB_URL:-postgresql://kesher:kesher@127.0.0.1:5432/kesher_test}"
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X)

echo "▸ reset + shim"
"${PSQL[@]}" -f supabase/tests/local/reset.sql
"${PSQL[@]}" -f supabase/tests/local/auth-shim.sql

echo "▸ migrations"
for file in supabase/migrations/*.sql; do
  echo "  $(basename "$file")"
  "${PSQL[@]}" -f "$file"
done

if [[ "${1:-}" == "--seed" ]]; then
  echo "▸ seed"
  for file in supabase/seed/*.sql; do
    echo "  $(basename "$file")"
    "${PSQL[@]}" -f "$file"
  done
fi

echo "▸ pgTAP"
shopt -s nullglob
tests=(supabase/tests/rls/*.sql)
if ((${#tests[@]} == 0)); then
  echo "  (no tests yet)"
  exit 0
fi
if command -v pg_prove >/dev/null 2>&1; then
  pg_prove --ext .sql -d "$DB_URL" "${tests[@]}"
else
  status=0
  for file in "${tests[@]}"; do
    echo "  $(basename "$file")"
    output=$("${PSQL[@]}" -f "$file" 2>&1) || status=1
    echo "$output" | grep -E "^(not ok|# )" && status=1 || true
    echo "$output" | grep -cE "^ok" | sed 's/^/    ok: /'
  done
  exit $status
fi
