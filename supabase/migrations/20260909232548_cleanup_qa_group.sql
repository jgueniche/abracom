-- Removes the throw-away group created on the Kesher project while checking the
-- group + poll flow end to end (see 20260909231425 and 20260909231458).
-- A no-op on any database that never carried it; kept so the repository and the
-- deployed project share one migration history.
delete from public.threads where kind = 'custom' and title like 'QA sortie %';
