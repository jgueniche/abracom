-- pgTAP : les deux fonctions qui remplacent des appels réseau (session 30, ADR-0061).
-- Elles sont `security definer` : la question est donc de savoir si elles répondent
-- sur l'appelant et sur personne d'autre.
begin;
select plan(8);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

\set admin '''a0000000-0000-4000-8000-000000000001'''
\set parent '''c0000000-0000-4000-8000-000000060001'''
\set other '''c0000000-0000-4000-8000-000000070001'''

-- La vérité de référence est lue en tant que superutilisateur, avant de prendre
-- l'identité de qui que ce soit : `auth.mfa_factors` est justement la table que
-- `security definer` sert à atteindre, et à laquelle `authenticated` n'a pas accès.
select
  exists (select 1 from auth.mfa_factors f
          where f.user_id = :parent and f.factor_type = 'totp' and f.status = 'verified') as parent_totp,
  exists (select 1 from auth.mfa_factors f
          where f.user_id = :admin and f.factor_type = 'totp' and f.status = 'verified') as admin_totp
\gset

-- ── mfa_enrolled ────────────────────────────────────────────────────────────
select pg_temp.login(:parent);
select is(public.mfa_enrolled(), :'parent_totp'::boolean,
  'la fonction dit la vérité de auth.mfa_factors pour l''appelant');
select is(public.mfa_enrolled(:admin), :'admin_totp'::boolean,
  'et reste factuelle si on l''interroge sur quelqu''un d''autre — elle ne livre aucun secret');
select ok(public.mfa_enrolled() is not null,
  'elle répond toujours quelque chose, jamais null, sinon la coquille redirigerait au hasard');
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mfa_enrolled' and p.prosecdef),
  1::bigint, 'elle est bien security definer, sinon auth.mfa_factors serait hors de portée');

-- ── unread_message_count ────────────────────────────────────────────────────
select is(
  public.unread_message_count(),
  (select coalesce(sum(t.unread_count), 0)::integer from public.my_threads() t where not t.archived),
  'le compteur est exactement la somme que l''écran calculait en TypeScript');
select ok(public.unread_message_count() >= 0, 'et il ne descend jamais sous zéro');

select pg_temp.login(:other);
select is(
  public.unread_message_count(),
  (select coalesce(sum(t.unread_count), 0)::integer from public.my_threads() t where not t.archived),
  'pour un autre parent, il compte ses conversations à lui');

-- ── ni l'un ni l'autre n'est ouvert à un visiteur ───────────────────────────
select is(
  (select count(*) from information_schema.role_routine_grants
   where routine_name in ('mfa_enrolled', 'unread_message_count') and grantee = 'anon'),
  0::bigint, 'aucune des deux n''est exécutable par anon');

select * from finish();
rollback;
