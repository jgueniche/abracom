-- `is_service_role()` used to answer true for any session whose `session_user` is `postgres` or
-- `supabase_admin`, whatever that session was then doing. `set role authenticated` does not change
-- `session_user`, so every request issued from such a connection — the Supabase SQL editor, an ops
-- psql session, and above all `supabase test db`, which is how the pgTAP suite runs on the platform
-- — was treated as the service key. Six hardening assertions (may_inspect, moderation columns,
-- pre-deleted messages, self-promotion to moderator) therefore passed in CI, where the suite
-- connects under an application role, and silently failed on a real Supabase stack.
--
-- The signal is the request context, not the login role: a session that carries a JWT is a user
-- request and is only "service" when the claim says so; a session that carries none is an ops or
-- pg_cron session and keeps its former privilege. Unlike `current_user`, this survives
-- `security definer`, whose functions are owned by `postgres`.
create or replace function public.is_service_role()
returns boolean
language sql stable
as $$
  with ctx as (
    select nullif(current_setting('request.jwt.claims', true), '') as claims,
           nullif(current_setting('request.jwt.claim.role', true), '') as claim_role,
           nullif(current_setting('request.jwt.claim.sub', true), '') as claim_sub
  )
  select case
    when claims is null and claim_role is null and claim_sub is null
      then session_user in ('postgres', 'supabase_admin')
    else coalesce(claim_role, claims::jsonb ->> 'role', '') = 'service_role'
  end
  from ctx;
$$;

comment on function public.is_service_role() is
  'True for the service key (PostgREST role claim) and for context-free sessions (pg_cron, migrations, ops psql). A session that carries a user JWT is never service, whatever role it connected as.';
