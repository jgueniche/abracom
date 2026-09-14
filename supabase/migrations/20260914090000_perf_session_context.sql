-- Session 30 — la latence (ADR-0061).
--
-- Deux fonctions qui remplacent des appels HTTP au serveur d'authentification par
-- une requête SQL ordinaire, payée en parallèle des autres.
--
--   • `mfa_enrolled()` — la coquille de l'application appelait `listFactors()` à
--     chaque rendu, qui est un `getUser()` déguisé : 53 ms d'aller-retour vers
--     GoTrue pour savoir si un facteur TOTP existe. La réponse est une ligne de
--     `auth.mfa_factors`, que Postgres lit en 1 ms.
--   • `unread_message_count()` — le badge de l'onglet Messages appelait
--     `my_threads()`, qui construit la liste complète des conversations avec leur
--     dernier message, pour en tirer un entier. Sur toutes les pages.

-- ── un facteur TOTP vérifié existe-t-il ? ────────────────────────────────────
create or replace function public.mfa_enrolled(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = uid and f.factor_type = 'totp' and f.status = 'verified'
  );
$$;
comment on function public.mfa_enrolled(uuid) is
  'True when the user has a verified TOTP factor. Replaces an auth-server round trip in the shell.';
revoke all on function public.mfa_enrolled(uuid) from public, anon;
grant execute on function public.mfa_enrolled(uuid) to authenticated, service_role;

-- ── combien de messages non lus, en un entier ────────────────────────────────
-- `my_threads()` reste la source pour l'écran ; ceci n'en est que le total, et
-- c'est tout ce dont la pastille a besoin.
create or replace function public.unread_message_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(t.unread_count), 0)::integer
  from public.my_threads() t
  where not t.archived;
$$;
comment on function public.unread_message_count() is
  'Total unread messages across live conversations — the tab badge, without the payload.';
revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated, service_role;
