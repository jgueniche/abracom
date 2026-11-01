-- pgTAP : les comptes partagés de l'école test (ADR-0079).
-- Un compte de l'école test et de rien d'autre s'ouvre avec le mot de passe commun de
-- l'« Espace de test » : aucun visiteur ne peut en changer le mot de passe ni l'adresse, y
-- ajouter une validation en deux étapes, ni le supprimer — même en contournant l'interface.
-- Un compte d'une vraie école, un administrateur de la plateforme, ou un compte que l'école
-- vient d'ouvrir avec un mot de passe provisoire n'en sont pas touchés.
begin;
select plan(24);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

create or replace function pg_temp.owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;

create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end $$;

create or replace function pg_temp.new_user(id uuid, email text, provisional boolean) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
      || case when provisional then '{"password_provisional": true}'::jsonb else '{}'::jsonb end,
    jsonb_build_object('first_name', 'Test', 'last_name', 'Partage', 'locale', 'fr'),
    now(), now(), '', '', '', ''
  );
end $$;

create or replace function pg_temp.password_is(uid uuid, password text) returns boolean language sql as $$
  select encrypted_password = extensions.crypt(password, encrypted_password) from auth.users where id = uid;
$$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set superadmin '''a0000000-0000-4000-8000-000000000003'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set real_school '''f0000000-0000-4000-8000-000000000001'''
\set real_parent '''f0000000-0000-4000-8000-00000000c001'''
\set newcomer '''f0000000-0000-4000-8000-00000000c002'''

-- A real school, with a parent of its own; and a parent the test school has just registered.
insert into public.schools (id, slug, name, city) values (:real_school, 'ecole-reelle', 'École réelle', 'Neuilly-sur-Seine');
select pg_temp.new_user(:real_parent, 'parent.reel@example.org', false);
select pg_temp.new_user(:newcomer, 'nouvelle.famille@example.org', true);
insert into public.memberships (user_id, school_id, role, status, accepted_at) values
  (:real_parent, :real_school, 'parent', 'active', now()),
  (:newcomer, :school, 'parent', 'active', now());

-- ══ 1. La règle ══════════════════════════════════════════════════════════
select ok(public.is_test_only_account(:parent1), 'a parent of the test school alone shares its password');
select ok(public.is_test_only_account(:admin), 'so does the test direction');
select ok(not public.is_test_only_account(:superadmin), 'a platform administrator is a real person, even inside the test school');
select ok(not public.is_test_only_account(:real_parent), 'and so is a parent of a real school');

select pg_temp.login(:parent1);
select throws_ok(format('select public.is_test_only_account(%L)', :real_parent), '42501', null,
  'nobody signed in may ask the question about someone else');

-- ══ 2. La suppression ════════════════════════════════════════════════════
select throws_ok($$select public.delete_my_account()$$, '23514', null,
  'a shared account of the test school cannot delete itself');
select pg_temp.owner();
select is((select last_name from public.profiles where id = :parent1), 'Aouizerate',
  'its profile is left as it was');
select cmp_ok((select count(*) from public.student_guardians where user_id = :parent1), '>', 0::bigint,
  'and so are its children');

select pg_temp.login(:real_parent);
select lives_ok($$select public.delete_my_account()$$, 'a parent of a real school still deletes their account');
select pg_temp.owner();
select is((select last_name from public.profiles where id = :real_parent), 'supprimé',
  'and it is anonymised');

-- ══ 3. Le mot de passe et l'adresse ══════════════════════════════════════
-- As Supabase Auth writes them: straight into auth.users.
update auth.users set encrypted_password = extensions.crypt('pirate-pirate', extensions.gen_salt('bf'))
 where id = :parent1;
select ok(pg_temp.password_is(:parent1, 'demo-password'), 'a shared account keeps the password everybody was given');
update auth.users set email = 'pirate@example.org' where id = :parent1;
select is((select email from auth.users where id = :parent1), 'parent-1@demo.local',
  'and the address everybody signs in with');

update auth.users
   set encrypted_password = extensions.crypt('provisoire-pirate', extensions.gen_salt('bf')),
       raw_app_meta_data = raw_app_meta_data || '{"password_provisional": true}'::jsonb
 where id = :parent1;
select ok(pg_temp.password_is(:parent1, 'demo-password'), 'a provisional password does not replace it either');
select ok(coalesce((select raw_app_meta_data ->> 'password_provisional' from auth.users where id = :parent1), '') <> 'true',
  'and no visitor is sent to choose a password of their own');

update auth.users set encrypted_password = extensions.crypt('un-autre-secret', extensions.gen_salt('bf'))
 where id = :superadmin;
select ok(pg_temp.password_is(:superadmin, 'un-autre-secret'), 'a platform administrator changes their own password');
update auth.users set encrypted_password = extensions.crypt('un-autre-secret', extensions.gen_salt('bf'))
 where id = :real_parent;
select ok(pg_temp.password_is(:real_parent, 'un-autre-secret'), 'so does a parent of a real school');

update auth.users
   set encrypted_password = extensions.crypt('mon-propre-secret', extensions.gen_salt('bf')),
       raw_app_meta_data = raw_app_meta_data - 'password_provisional'
 where id = :newcomer;
select ok(pg_temp.password_is(:newcomer, 'mon-propre-secret'),
  'a family the test school has just registered still replaces its provisional password');

-- The platform, through set_test_school_password, and an operator who says so.
select pg_temp.service();
select cmp_ok(public.set_test_school_password('espace-de-test-2026'), '>', 100,
  'the platform still sets the one password of the test school');
select pg_temp.owner();
select ok(pg_temp.password_is(:parent1, 'espace-de-test-2026'), 'and the shared accounts open with it');
select is(coalesce(current_setting('kesher.allow_test_account_change', true), ''), '',
  'the permission ends with the function: nothing after it inherits it');
set local kesher.allow_test_account_change = 'on';
update auth.users set encrypted_password = extensions.crypt('choix-operateur', extensions.gen_salt('bf'))
 where id = :parent1;
select ok(pg_temp.password_is(:parent1, 'choix-operateur'), 'an operator who says so in their transaction may change it');
set local kesher.allow_test_account_change = '';

-- ══ 4. La validation en deux étapes ══════════════════════════════════════
select throws_ok(
  format($$insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
           values (gen_random_uuid(), %L, 'pirate', 'totp', 'unverified', now(), now())$$, :parent1),
  '42501', null, 'a shared account takes no second factor: only one visitor would hold the code');
select lives_ok(
  format($$insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
           values (gen_random_uuid(), %L, 'Kesher', 'totp', 'unverified', now(), now())$$, :superadmin),
  'a real person still enrols one');
select is((select count(*) from auth.mfa_factors where user_id = :parent1), 0::bigint,
  'and the shared account has none');

select * from finish();
rollback;
