-- pgTAP : plusieurs écoles, une école test, des familles inscrites par l'école (session 34).
-- Seul l'administrateur de la plateforme ouvre une école, et il en reçoit la direction ;
-- le mot de passe de l'école test ne change que les comptes de l'école test, jamais un
-- administrateur de la plateforme ni quelqu'un qui appartient aussi à une vraie école ;
-- une famille s'inscrit d'un bloc, par la direction seule, et rien ne reste d'un refus.
begin;
select plan(32);

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

-- The service key, as PostgREST presents it — the same on the Supabase stack and on a plain
-- PostgreSQL, where the owner of the session is not `postgres`.
create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end $$;

create or replace function pg_temp.new_user(id uuid, email text) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('provisoire-1234', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"], "password_provisional": true}'::jsonb,
    jsonb_build_object('first_name', 'Test', 'last_name', 'Famille', 'locale', 'fr'),
    now(), now(), '', '', '', ''
  );
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set superadmin '''a0000000-0000-4000-8000-000000000003'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set mother '''f0000000-0000-4000-8000-000000000001'''
\set father '''f0000000-0000-4000-8000-000000000002'''

-- ══ 1. Ouvrir une école ══════════════════════════════════════════════════
select pg_temp.login(:superadmin);
select lives_ok(
  $$select public.create_school('Abravanel Levallois', 'Levallois-Perret')$$,
  'the platform administrator opens a school');
select public.create_school('Abravanel Levallois') as second_school \gset
select pg_temp.owner();
select is((select slug from public.schools where name = 'Abravanel Levallois' and city = 'Levallois-Perret'),
  'abravanel-levallois', 'its address on the platform comes from its name, without accents');
select is((select slug from public.schools where id = :'second_school'),
  'abravanel-levallois-2', 'and a second school of the same name gets the next free one');
select is((select count(*) from public.levels l join public.schools s on s.id = l.school_id
           where s.slug = 'abravanel-levallois'), 9::bigint,
  'it is born with its nine levels, from TPS to CM2, which no screen creates');
select is((select count(*) from public.memberships m join public.schools s on s.id = m.school_id
           where s.slug = 'abravanel-levallois' and m.user_id = :superadmin
             and m.role = 'school_admin' and m.status = 'active'), 1::bigint,
  'and its creator holds its direction at once, so that it shows in their selector');
select ok(exists (select 1 from public.audit_log where action = 'school.create' and actor_id = :superadmin),
  'the opening is in the journal');
select is((select modules @> '{"test": true}'::jsonb from public.schools where slug = 'abravanel-levallois'),
  false, 'a school that is opened is a real school, never a test one');

select pg_temp.login(:admin);
select throws_ok($$select public.create_school('École pirate')$$, '42501', null,
  'the direction of a school does not open another one');
select pg_temp.login(:parent1);
select throws_ok($$select public.create_school('École pirate')$$, '42501', null,
  'nor does a parent');
select pg_temp.login(:superadmin);
select throws_ok($$select public.create_school('  ')$$, '22023', null,
  'a school without a name is refused');

-- ══ 2. Le mot de passe de l'école test ═══════════════════════════════════
-- Maya's mother also becomes a parent in the real school: she must keep her password.
select pg_temp.owner();
insert into public.memberships (school_id, user_id, role, status, accepted_at)
select id, :parent1, 'parent', 'active', now() from public.schools where slug = 'abravanel-levallois';

select pg_temp.login(:admin);
select throws_ok($$select public.set_test_school_password('un-mot-de-passe-long')$$, '42501', null,
  'the direction of the test school may not set it: only the platform, through its service key');
select pg_temp.service();
select throws_ok($$select public.set_test_school_password('court')$$, '22023', null,
  'a password of fewer than ten characters is refused');
select cmp_ok(public.set_test_school_password('espace-de-test-2026'), '>', 100,
  'the service key sets it for every account of the test school');
select pg_temp.owner();
select ok((select encrypted_password = extensions.crypt('espace-de-test-2026', encrypted_password)
           from auth.users where id = :admin),
  'the test direction now opens with it');
select ok((select encrypted_password = extensions.crypt('demo-password', encrypted_password)
           from auth.users where id = :superadmin),
  'a platform administrator keeps their own password');
select ok((select encrypted_password = extensions.crypt('demo-password', encrypted_password)
           from auth.users where id = :parent1),
  'and so does someone who also belongs to a real school');

-- ══ 3. Inscrire une famille ══════════════════════════════════════════════
select pg_temp.owner();
select pg_temp.new_user(:mother, 'mere.famille@example.org');
select pg_temp.new_user(:father, 'pere.famille@example.org');

select pg_temp.login(:admin);
select lives_ok(
  format($$select public.create_family(%L, 'Famille Exemple',
           %L::jsonb, %L::jsonb)$$,
         :school,
         json_build_array(
           json_build_object('user_id', :mother, 'relation', 'mother', 'is_primary', true),
           json_build_object('user_id', :father, 'relation', 'father', 'is_primary', false)),
         json_build_array(
           json_build_object('first_name', 'Ada', 'last_name', 'Exemple', 'birth_date', '2022-03-04', 'class_id', :class_ps),
           json_build_object('first_name', 'Ben', 'last_name', 'Exemple', 'birth_date', '', 'class_id', ''))),
  'the direction registers two parents and two children in one go');
select is((select count(*) from public.students s join public.families f on f.id = s.family_id
           where f.name = 'Famille Exemple' and s.school_id = :school), 2::bigint,
  'both children belong to the family, in this school');
select is((select count(*) from public.enrollments e join public.students s on s.id = e.student_id
           where s.first_name = 'Ada' and s.last_name = 'Exemple' and e.class_id = :class_ps and e.left_on is null), 1::bigint,
  'the first one is in her class');
select is((select count(*) from public.enrollments e join public.students s on s.id = e.student_id
           where s.first_name = 'Ben' and s.last_name = 'Exemple'), 0::bigint,
  'the second one waits for a class, which is allowed');
select is((select count(*) from public.student_guardians g join public.students s on s.id = g.student_id
           where s.last_name = 'Exemple'), 4::bigint,
  'each parent is linked to each child');
select is((select count(*) from public.student_guardians g join public.students s on s.id = g.student_id
           where s.last_name = 'Exemple' and g.user_id = :mother and g.is_primary and g.relation = 'mother'), 2::bigint,
  'with the relation and the primary guardian that were given');
select is((select string_agg(status::text, ',') from public.memberships
           where school_id = :school and role = 'parent' and user_id in (:mother, :father)),
  'invited,invited', 'the parents are invited until their first sign-in');
select ok(exists (select 1 from public.audit_log where action = 'family.create' and actor_id = :admin),
  'the registration is in the journal');

-- a parent already known to the school is linked again, never duplicated
select lives_ok(
  format($$select public.create_family(%L, 'Famille Exemple bis', %L::jsonb, %L::jsonb)$$,
         :school,
         json_build_array(json_build_object('user_id', :mother, 'relation', 'mother', 'is_primary', true)),
         json_build_array(json_build_object('first_name', 'Clara', 'last_name', 'Exemple', 'class_id', :class_ps))),
  'a known parent can be given another child');
select is((select count(*) from public.memberships where school_id = :school and user_id = :mother and role = 'parent'),
  1::bigint, 'without a second membership');

select throws_ok(
  format($$select public.create_family(%L, 'Famille Fantôme', %L::jsonb, %L::jsonb)$$,
         :school,
         json_build_array(json_build_object('user_id', :father, 'relation', 'father')),
         json_build_array(json_build_object('first_name', 'Dan', 'last_name', 'Fantôme', 'class_id', gen_random_uuid()))),
  '22023', null, 'a class that is not one of the school''s current classes is refused');
select is((select count(*) from public.families where name = 'Famille Fantôme'), 0::bigint,
  'and nothing of that family is left behind');
select throws_ok(
  format($$select public.create_family(%L, 'Trop', %L::jsonb, %L::jsonb)$$,
         :school,
         json_build_array(json_build_object('user_id', :mother), json_build_object('user_id', :father),
                          json_build_object('user_id', :parent1)),
         json_build_array(json_build_object('first_name', 'E', 'last_name', 'F'))),
  '22023', null, 'a family has one or two parents');
select throws_ok(
  format($$select public.create_family(%L, 'Vide', %L::jsonb, '[]'::jsonb)$$,
         :school, json_build_array(json_build_object('user_id', :mother))),
  '22023', null, 'and at least one child');

select pg_temp.login(:staff);
select throws_ok(
  format($$select public.create_family(%L, 'Famille Secrétariat', %L::jsonb, %L::jsonb)$$,
         :school,
         json_build_array(json_build_object('user_id', :mother)),
         json_build_array(json_build_object('first_name', 'G', 'last_name', 'H'))),
  '42501', null, 'the secretariat does not register families: it would grant memberships');
select pg_temp.login(:superadmin);
select throws_ok(
  format($$select public.create_family(%L, 'Ailleurs', %L::jsonb, %L::jsonb)$$,
         :'second_school',
         json_build_array(json_build_object('user_id', :mother)),
         json_build_array(json_build_object('first_name', 'I', 'last_name', 'J', 'class_id', :class_ps))),
  '22023', null, 'a class of another school is refused, even for the platform administrator');

select * from finish();
rollback;
