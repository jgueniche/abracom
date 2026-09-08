#!/usr/bin/env bash
# Staging → production switch for the Supabase project (docs/DEPLOIEMENT.md).
#   scripts/ops/promote.sh <project-ref>
# Links the CLI to the cloud project, pushes the versioned migrations, then prints what remains manual.
set -euo pipefail
ref="${1:?usage: scripts/ops/promote.sh <supabase-project-ref>}"

echo "▸ linking to $ref"
supabase link --project-ref "$ref"
echo "▸ pending migrations"
supabase migration list
read -r -p "Apply migrations to $ref? [y/N] " answer
[[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "aborted"; exit 1; }
supabase db push

echo "▸ auth configuration and e-mail templates (supabase/config.toml)"
if grep -q '^\[remotes\.' supabase/config.toml; then
  supabase config diff || true
  read -r -p "Push the auth configuration (Site URL, redirects, templates) to $ref? [y/N] " answer
  if [[ "$answer" == "y" || "$answer" == "Y" ]]; then
    supabase config push
  fi
else
  echo "  skipped: add a [remotes.<name>] block with project_id = \"$ref\" first (docs/DEPLOIEMENT.md)"
fi

cat <<'EOF'

Done. Remaining manual steps (see docs/DEPLOIEMENT.md):
  1. SQL editor: run supabase/jobs/cron.sql after storing the two Vault secrets.
  2. Storage: create the private buckets if the migration did not (attachments, documents,
     class-media, avatars, justifications, messages).
  3. Auth: SMTP / Resend sender (Site URL, redirects, TOTP and templates come from config.toml).
  4. Vercel: pnpm ops:check-env --prod, then promote the deployment.
  5. Smoke test with the demo accounts (docs/DEMO.md), then invite the real staff.
EOF
