#!/usr/bin/env bash
# Applies supabase/migrations/*.sql to a hosted project through the Management API (no database
# password needed, only SUPABASE_ACCESS_TOKEN) and records them in supabase_migrations.schema_migrations
# so that `supabase migration list` / `db push` see them as applied. Idempotent: already recorded
# versions are skipped.
#   SUPABASE_ACCESS_TOKEN=... scripts/ops/apply-migrations.sh <project-ref> [--seed]
set -euo pipefail
cd "$(dirname "$0")/../.."
ref="${1:?usage: scripts/ops/apply-migrations.sh <project-ref> [--seed]}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
api="https://api.supabase.com/v1/projects/$ref/database/query"
applied_count=0
skipped_count=0

run_sql() { # $1 = sql text ; prints the JSON answer
  jq -Rn --arg q "$1" '{query: $q}' | curl -sS --max-time 300 -X POST "$api" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @-
}
run_file() { # $1 = path
  jq -Rs '{query: .}' "$1" | curl -sS --max-time 300 -X POST "$api" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @-
}
failed() { # $1 = json answer → 0 when it carries an error message
  echo "$1" | jq -e 'type == "object" and has("message")' >/dev/null 2>&1
}

run_sql "create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);" >/dev/null
applied=$(run_sql "select coalesce(string_agg(version, ','), '') as v from supabase_migrations.schema_migrations" | jq -r '.[0].v')

for file in supabase/migrations/*.sql; do
  base=$(basename "$file" .sql)
  version=${base%%_*}
  name=${base#*_}
  if [[ ",$applied," == *",$version,"* ]]; then
    echo "  = $base (already applied)"
    skipped_count=$((skipped_count + 1))
    continue
  fi
  echo "  + $base"
  answer=$(run_file "$file")
  if failed "$answer"; then
    echo "FAILED: $answer" >&2
    exit 1
  fi
  run_sql "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name') on conflict do nothing" >/dev/null
  applied_count=$((applied_count + 1))
done

if [[ "${2:-}" == "--seed" ]]; then
  for file in supabase/seed/*.sql; do
    echo "  ~ seed $(basename "$file")"
    answer=$(run_file "$file")
    if failed "$answer"; then
      echo "FAILED: $answer" >&2
      exit 1
    fi
  done
fi
echo "done: $applied_count applied, $skipped_count already present"
