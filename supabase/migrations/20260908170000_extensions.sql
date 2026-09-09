-- Extensions live in the `extensions` schema on Supabase.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- French full-text search that ignores accents (used by generated tsvector columns).
create text search configuration public.french_unaccent (copy = pg_catalog.french);
alter text search configuration public.french_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, french_stem;
