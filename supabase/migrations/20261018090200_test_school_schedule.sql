-- The test school's nightly refresh (ADR-0077), scheduled by a migration rather than by
-- supabase/jobs/cron.sql: it needs no Vault secret, so it ships with the migrations the deploy
-- workflow applies, and the test school cannot age on a project where nobody replayed cron.sql.
-- Only where pg_cron is installed — the hosted project, by cron.sql; a local stack and the CI
-- shim have none and skip it. cron.schedule() replaces a job of the same name: replaying this is
-- harmless, and the job runs as the role that applies the migrations, which owns the function.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'kesher-test-school-content',
      '15 4 * * *',
      'select public.refresh_test_school_content();'
    );
  end if;
end
$$;
