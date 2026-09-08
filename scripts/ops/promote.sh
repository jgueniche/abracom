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

cat <<'EOF'

Done. Remaining manual steps (see docs/DEPLOIEMENT.md):
  1. SQL editor: run supabase/jobs/cron.sql after storing the two Vault secrets.
  2. Storage: create the private buckets if the migration did not (attachments, documents,
     class-media, avatars, justifications, messages).
  3. Auth: set the Site URL and redirect URLs, enable TOTP MFA, configure the SMTP / Resend sender.
  4. Vercel: pnpm ops:check-env --prod, then promote the deployment.
  5. Smoke test with the demo accounts (docs/DEMO.md), then invite the real staff.
EOF
