-- pgTAP : les menus de la semaine (session 32). L'école écrit, tout le monde
-- lit, une autre école ne voit rien ; et `save_weekly_menu` enregistre la
-- semaine et ses jours en une transaction sous les mêmes politiques.
begin;
select plan(31);

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

\set school '''00000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
-- read-only guardian of family 005
\set readonly '''c0000000-0000-4000-8000-000000050003'''
-- a week in the future, so the seed's own menus never collide with the test
\set week '''2027-03-01'''

-- ══ 1. L'école écrit ══════════════════════════════════════════════════════
select pg_temp.login(:staff);
select lives_ok(
  format($$insert into public.weekly_menus (school_id, week_start, created_by) values (%L, %L, %L)$$,
         :school, :week, :staff),
  'the secretariat creates the menu of a week');
create temporary table t_menu on commit drop as
select id from public.weekly_menus where school_id = :school and week_start = :week;
select is((select count(*) from t_menu), 1::bigint, 'the menu exists');

select throws_ok(
  format($$insert into public.weekly_menus (school_id, week_start, created_by) values (%L, %L, %L)$$,
         :school, :week, :staff),
  '23505', null, 'one menu per school and per week');
select throws_ok(
  format($$insert into public.weekly_menus (school_id, week_start, created_by) values (%L, %L, %L)$$,
         :school, '2027-03-03', :staff),
  '23514', null, 'a week is named by its Monday, nothing else');

select lives_ok(
  format($$insert into public.weekly_menu_days (menu_id, day, starter, main_course, side, dessert, snack)
           values ((select id from t_menu), 1, 'Carottes râpées', 'Poulet rôti', 'Riz', 'Compote', 'Pain et chocolat')$$),
  'and fills a day');
select throws_ok(
  format($$insert into public.weekly_menu_days (menu_id, day, main_course) values ((select id from t_menu), 6, 'Impossible')$$),
  '23514', null, 'Saturday is not a canteen day');
select throws_ok(
  format($$insert into public.weekly_menu_days (menu_id, day, main_course) values ((select id from t_menu), 1, 'Deux fois lundi')$$),
  '23505', null, 'one row per day');

-- the direction writes too
select pg_temp.login(:admin);
select lives_ok(
  format($$update public.weekly_menu_days set dessert = 'Fruit de saison'
           where menu_id = (select id from t_menu) and day = 1$$),
  'the direction edits a published menu');

-- ══ 2. Tout le monde lit ═════════════════════════════════════════════════
select pg_temp.login(:parent1);
select is((select count(*) from public.weekly_menus where week_start = :week), 1::bigint,
  'a parent reads the menu of the week');
select is((select dessert from public.weekly_menu_days where menu_id = (select id from t_menu) and day = 1),
  'Fruit de saison', 'with the courses of the day, as last edited');

select pg_temp.login(:readonly);
select is((select count(*) from public.weekly_menus where week_start = :week), 1::bigint,
  'a read-only guardian reads it too — it is exactly what they are entitled to');

select pg_temp.login(:teacher_ps);
select is((select count(*) from public.weekly_menu_days where menu_id = (select id from t_menu)), 1::bigint,
  'a teacher reads the days');

-- ══ 3. … mais n'écrit pas ═════════════════════════════════════════════════
select pg_temp.login(:parent1);
select throws_ok(
  format($$insert into public.weekly_menus (school_id, week_start, created_by) values (%L, %L, %L)$$,
         :school, '2027-03-08', :parent1),
  '42501', null, 'a parent does not create a menu');
-- an update or a delete without the right reaches no row: RLS filters, it
-- does not raise — so the proof is that nothing changed
update public.weekly_menu_days set main_course = 'Pizza' where menu_id = (select id from t_menu);
select is(
  (select main_course from public.weekly_menu_days where menu_id = (select id from t_menu) and day = 1),
  'Poulet rôti', 'a parent''s update reaches no row');
delete from public.weekly_menus where id = (select id from t_menu);
select is((select count(*) from public.weekly_menus where id = (select id from t_menu)), 1::bigint,
  'nor does a parent''s delete');

select pg_temp.login(:teacher_ps);
select throws_ok(
  format($$insert into public.weekly_menu_days (menu_id, day, main_course) values ((select id from t_menu), 2, 'Omelette')$$),
  '42501', null, 'a teacher does not write a day either');

-- ══ 4. Une autre école ne voit rien ════════════════════════════════════════
select pg_temp.owner();
\set school_b '''f0000000-0000-4000-8000-000000000001'''
\set admin_b '''f0000000-0000-4000-8000-00000000a001'''
insert into public.schools (id, slug, name, city)
values (:school_b, 'ecole-test-b', 'École test B', 'Levallois-Perret');
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', :admin_b, 'authenticated', 'authenticated', 'admin-b@demo.local',
  extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"first_name": "Direction", "last_name": "Test B", "locale": "fr"}'::jsonb,
  now(), now(), '', '', '', ''
);
insert into public.memberships (user_id, school_id, role, status, accepted_at)
values (:admin_b, :school_b, 'school_admin', 'active', now());

select pg_temp.login(:admin_b);
select is((select count(*) from public.weekly_menus), 0::bigint,
  'the direction of school B sees no menu of school A');
select is((select count(*) from public.weekly_menu_days), 0::bigint,
  'nor any of its days');
select throws_ok(
  format($$insert into public.weekly_menus (school_id, week_start, created_by) values (%L, %L, %L)$$,
         :school, '2027-03-15', :admin_b),
  '42501', null, 'and cannot write a menu for school A');
select lives_ok(
  format($$select public.save_weekly_menu(%L, %L, '[{"day": 1, "main_course": "Menu B"}]'::jsonb)$$,
         :school_b, :week),
  'but writes its own');
select pg_temp.login(:parent1);
select is((select count(*) from public.weekly_menus where school_id = :school_b), 0::bigint,
  'which a parent of school A never sees');

-- ══ 5. save_weekly_menu : la semaine et ses jours en une transaction ═════════
select pg_temp.login(:staff);
\set week2 '''2027-03-08'''
select lives_ok(
  format($$select public.save_weekly_menu(%L, %L, $j$[
    {"day": 1, "starter": "Betteraves", "main_course": "Boulettes de bœuf", "side": "Semoule", "dessert": "Orange", "snack": "Gâteau"},
    {"day": 2, "starter": " ", "main_course": "Poisson pané", "side": "Purée", "dessert": "", "snack": "Compote", "note": "Sans gluten disponible"},
    {"day": 3, "starter": "", "main_course": "", "side": "", "dessert": "", "snack": "", "note": ""},
    {"day": 4, "main_course": "Couscous de légumes"},
    {"day": 5, "main_course": "Poulet au citron", "dessert": "Salade de fruits"}
  ]$j$::jsonb)$$, :school, :week2),
  'the secretariat saves a whole week in one call');
select is(
  (select count(*) from public.weekly_menu_days d join public.weekly_menus m on m.id = d.menu_id
   where m.week_start = :week2),
  4::bigint, 'four days kept — the blank Wednesday is dropped, not stored empty');
select is(
  (select starter from public.weekly_menu_days d join public.weekly_menus m on m.id = d.menu_id
   where m.week_start = :week2 and d.day = 2),
  null, 'a blank string becomes null');
select is(
  (select note from public.weekly_menu_days d join public.weekly_menus m on m.id = d.menu_id
   where m.week_start = :week2 and d.day = 2),
  'Sans gluten disponible', 'the note of a day is kept');

-- saving the same week again updates it: no duplicate, the Monday changes
select lives_ok(
  format($$select public.save_weekly_menu(%L, %L, '[{"day": 1, "main_course": "Poulet rôti"}]'::jsonb)$$,
         :school, :week2),
  'saving the same week again is an update');
select is((select count(*) from public.weekly_menus where week_start = :week2), 1::bigint,
  'still one menu for that week');
select is(
  (select main_course from public.weekly_menu_days d join public.weekly_menus m on m.id = d.menu_id
   where m.week_start = :week2 and d.day = 1),
  'Poulet rôti', 'and the Monday now says what was last saved');

-- a week with nothing on any day is refused, not published empty
select throws_ok(
  format($$select public.save_weekly_menu(%L, %L, '[{"day": 1, "main_course": " "}, {"day": 2}]'::jsonb)$$,
         :school, '2027-03-15'),
  '23514', null, 'an empty week is refused');

-- a parent calling the function gets the same door as on the table
select pg_temp.login(:parent1);
select throws_ok(
  format($$select public.save_weekly_menu(%L, %L, '[{"day": 1, "main_course": "Frites"}]'::jsonb)$$,
         :school, '2027-03-22'),
  '42501', null, 'a parent cannot save a menu through the function either');

select is(
  (select count(*) from information_schema.role_routine_grants
   where routine_name = 'save_weekly_menu' and grantee = 'anon'),
  0::bigint, 'and a visitor cannot execute it');

select * from finish();
rollback;
