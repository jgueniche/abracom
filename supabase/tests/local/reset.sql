-- Wipes the local test database (never run against Supabase).
drop schema if exists public cascade;
drop schema if exists auth cascade;
drop schema if exists storage cascade;
drop schema if exists extensions cascade;
create schema public;
grant usage on schema public to public;
grant all on schema public to public;
