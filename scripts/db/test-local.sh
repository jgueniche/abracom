#!/usr/bin/env bash
# Applies the migrations (and optionally the seed) to a throw-away local PostgreSQL
# database with a Supabase shim, then runs the pgTAP RLS tests.
#
#   scripts/db/test-local.sh              # migrations + tests
#   scripts/db/test-local.sh --seed       # migrations + seed + tests
#   KESHER_TEST_DB_URL=postgresql://... scripts/db/test-local.sh
#
# `--supabase` runs the pgTAP files against a Supabase stack that is already up
# (`pnpm db:start`), on its real auth / storage schemas instead of the shim —
# the platform the application actually ships on. Every test file wraps itself
# in `begin … rollback`, so the development data is left untouched.
#
#   scripts/db/test-local.sh --supabase
set -euo pipefail
cd "$(dirname "$0")/../.."

mode="${1:-}"

if [[ "$mode" == "--supabase" ]]; then
  DB_URL="${KESHER_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
else
  DB_URL="${KESHER_TEST_DB_URL:-postgresql://kesher:kesher@127.0.0.1:5432/kesher_test}"
fi
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X)

if [[ "$mode" != "--supabase" ]]; then
  echo "▸ reset + shim"
  "${PSQL[@]}" -f supabase/tests/local/reset.sql
  "${PSQL[@]}" -f supabase/tests/local/auth-shim.sql

  echo "▸ migrations"
  for file in supabase/migrations/*.sql; do
    echo "  $(basename "$file")"
    "${PSQL[@]}" -f "$file"
  done

  if [[ "$mode" == "--seed" ]]; then
    echo "▸ seed"
    for file in supabase/seed/*.sql; do
      echo "  $(basename "$file")"
      "${PSQL[@]}" -f "$file"
    done
  fi
else
  echo "▸ Supabase stack: $DB_URL (migrations and seed already applied by db:reset)"
  "${PSQL[@]}" -c "create extension if not exists pgtap with schema extensions;"
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
  # Fallback without pg_prove. `--tuples-only --no-align` makes psql print the
  # pgTAP rows as plain TAP, which is what the counters below match on: the
  # default aligned output indents every line, so a `^ok` match found nothing
  # and `grep -c`'s exit status then killed the run through `pipefail`.
  status=0
  total=0
  for file in "${tests[@]}"; do
    output=$("${PSQL[@]}" --tuples-only --no-align -f "$file" 2>&1) || status=1
    passed=$(grep -cE '^ok [0-9]+' <<<"$output" || true)
    failed=$(grep -cE '^not ok' <<<"$output" || true)
    total=$((total + passed))
    printf '  %-26s %3s ok' "$(basename "$file")" "$passed"
    if ((failed > 0)) || [[ "$output" == *"ERROR:"* ]]; then
      status=1
      ((failed > 0)) && printf ', %s FAILED' "$failed"
      printf '\n'
      grep -E '^(not ok|#|psql:|ERROR)' <<<"$output" | head -20 | sed 's/^/      /'
    else
      printf '\n'
    fi
  done
  echo "  ── $total assertions"
  exit $status
fi
