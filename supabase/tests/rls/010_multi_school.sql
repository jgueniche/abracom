-- pgTAP: multi-school isolation (school_id everywhere, brief §1). A second, entirely fictional
-- school with its own direction, teacher, family and content is created inside the transaction;
-- nothing of it may leak to the demo school and vice versa. Run by scripts/db/test-local.sh.
begin;
select plan(39);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;

create or replace function pg_temp.create_user(id uuid, email text, first_name text, last_name text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('first_name', first_name, 'last_name', last_name, 'locale', 'fr'),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', id::text, now(), now(), now());
end $$;

-- demo school (A) fixtures ------------------------------------------------------
\set school_a '''00000000-0000-4000-8000-000000000001'''
\set year_a '''00000000-0000-4000-8000-000000000016'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set period_a '''00000000-0000-4000-8000-000000000769'''
\set ann_a '''00000000-0000-4000-8000-000000001281'''
\set event_a '''00000000-0000-4000-8000-000000002049'''
\set slot_a '''00000000-0000-4000-8000-000000003585'''
\set admin_a '''a0000000-0000-4000-8000-000000000001'''
\set superadmin '''a0000000-0000-4000-8000-000000000003'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''

-- second school (B) fixtures, prefix f ---------------------------------------------
\set school_b '''f0000000-0000-4000-8000-000000000001'''
\set year_b '''f0000000-0000-4000-8000-000000000016'''
\set level_b '''f0000000-0000-4000-8000-000000000258'''
\set class_b '''f0000000-0000-4000-8000-000000000514'''
\set period_b '''f0000000-0000-4000-8000-000000000769'''
\set family_b '''f0000000-0000-4000-8000-000000000e01'''
\set student_b '''f0000000-0000-4000-8000-00000000d001'''
\set admin_b '''f0000000-0000-4000-8000-00000000a001'''
\set teacher_b '''f0000000-0000-4000-8000-00000000b001'''
\set parent_b '''f0000000-0000-4000-8000-00000000c001'''
\set ann_b '''f0000000-0000-4000-8000-000000001281'''
\set event_b '''f0000000-0000-4000-8000-000000002049'''

insert into public.schools (id, slug, name, city, timezone, locale_default, modules)
values (:school_b, 'ecole-test-b', 'École test B', 'Levallois-Perret', 'Europe/Paris', 'fr',
  '{"announcements": true, "classes": true, "messaging": true, "agenda": true, "community": true, "assessments": {"scores": false}, "directory": true, "marketplace": true}'::jsonb);
insert into public.school_years (id, school_id, label, starts_on, ends_on, is_current)
values (:year_b, :school_b, '2026-2027', '2026-09-01', '2027-07-06', true);
insert into public.levels (id, school_id, code, label_fr, label_en, sort_order)
values (:level_b, :school_b, 'PS', 'Petite section', 'Nursery', 2);
insert into public.classes (id, school_id, school_year_id, level_id, name, room, capacity)
values (:class_b, :school_b, :year_b, :level_b, 'PS Test', 'B1', 26);
insert into public.assessment_periods (id, school_id, school_year_id, label, starts_on, ends_on, sort_order)
values (:period_b, :school_b, :year_b, 'Période 1', '2026-09-01', '2026-12-18', 1);

select pg_temp.create_user(:admin_b, 'admin-b@demo.local', 'Direction', 'Test B');
select pg_temp.create_user(:teacher_b, 'teacher-b@demo.local', 'Enseignante', 'Test B');
select pg_temp.create_user(:parent_b, 'parent-b@demo.local', 'Parent', 'Test B');
insert into public.memberships (user_id, school_id, role, status, accepted_at) values
  (:admin_b, :school_b, 'school_admin', 'active', now()),
  (:teacher_b, :school_b, 'teacher', 'active', now()),
  (:parent_b, :school_b, 'parent', 'active', now());
insert into public.class_teachers (class_id, user_id, role) values (:class_b, :teacher_b, 'main');
insert into public.families (id, school_id, name) values (:family_b, :school_b, 'Famille Test B');
insert into public.students (id, school_id, family_id, first_name, last_name, birth_date)
values (:student_b, :school_b, :family_b, 'Élève', 'Test B', '2023-03-01');
insert into public.enrollments (student_id, class_id, school_year_id, joined_on)
values (:student_b, :class_b, :year_b, '2026-09-01');
insert into public.student_guardians (student_id, user_id, relation, is_primary)
values (:student_b, :parent_b, 'mother', true);
insert into public.announcements (id, school_id, author_id, audience, target_ids, title, body_md, pinned, requires_ack, published_at, template)
values (:ann_b, :school_b, :admin_b, 'school', '{}', 'Annonce isolée école B', 'Contenu réservé à l''école B.', false, false, now() - interval '1 day', 'circular');
insert into public.events (id, school_id, scope, target_ids, title, description_md, starts_at, ends_at, all_day, kind, created_by)
values (:event_b, :school_b, 'school', '{}', 'Événement isolé école B', 'Réservé à l''école B.', now() + interval '3 days', now() + interval '3 days 1 hour', false, 'meeting', :admin_b);

-- parent of school A ---------------------------------------------------------------
select pg_temp.login(:parent1);
select is((select count(*) from public.schools), 1::bigint, 'parent of school A still sees exactly one school');
select is((select count(*) from public.classes where school_id = :school_b), 0::bigint, 'parent of school A sees no class of school B');
select is((select count(*) from public.students where school_id = :school_b), 0::bigint, 'parent of school A sees no pupil of school B');
select is((select count(*) from public.announcements where school_id = :school_b), 0::bigint, 'parent of school A sees no announcement of school B');
select is((select count(*) from public.events where school_id = :school_b), 0::bigint, 'parent of school A sees no event of school B');
select is((select count(*) from public.profiles where id in (:admin_b, :teacher_b, :parent_b)), 0::bigint, 'profiles of school B members are invisible from school A');
select is((select count(*) from public.global_search('isolée')), 0::bigint, 'global search never surfaces school B content');
select is(public.can_access_class(:class_b), false, 'can_access_class is false for a class of school B');
select is(public.can_view_event(:event_b), false, 'can_view_event is false for an event of school B');
select throws_ok(format('select public.open_dm(%L)', :parent_b), null, null, 'a parent cannot open a direct message with a parent of another school');

-- direction of school A ------------------------------------------------------------
select pg_temp.login(:admin_a);
select is((select count(*) from public.students where school_id = :school_b), 0::bigint, 'direction of school A sees no pupil of school B');
select is((select count(*) from public.memberships where school_id = :school_b), 0::bigint, 'direction of school A sees no membership of school B');
select is((select count(*) from public.class_directory(:class_b)), 0::bigint, 'the directory of a school B class is empty for school A direction');
select is((select count(*) from public.announcement_recipients(:ann_b)), 0::bigint, 'recipients of a school B announcement are hidden from school A direction');
select throws_ok(format('select public.remind_announcement(%L)', :ann_b), null, null, 'school A direction cannot send reminders for a school B announcement');
select throws_ok(format('select public.set_current_school_year(%L)', :year_b), '42501', null, 'school A direction cannot change the current year of school B');
select throws_ok(format('select public.ensure_class_threads(%L)', :class_b), '42501', null, 'school A direction cannot create threads for a school B class');
select throws_ok(format('select public.publish_assessments(%L, %L)', :class_b, :period_b), null, null, 'school A direction cannot publish assessments of a school B class');
select throws_ok(format('select public.promote_school_year(%L, %L, %L)', :year_a, :year_b, '[]'), null, null, 'a promotion between years of two different schools is refused');
select throws_ok(format('insert into public.classes (school_id, school_year_id, level_id, name) values (%L, %L, %L, %L)', :school_b, :year_b, :level_b, 'Intrus'), '42501', null, 'school A direction cannot create a class in school B');
select throws_ok(format('insert into public.announcements (school_id, author_id, audience, target_ids, title, body_md) values (%L, %L, %L, %L, %L, %L)', :school_b, :admin_a, 'school', '{}', 'Intrusion', 'x'), '42501', null, 'school A direction cannot publish in school B');
update public.schools set name = 'Piratée' where id = :school_b;
select pg_temp.owner();
select is((select name from public.schools where id = :school_b), 'École test B', 'an update of school B by school A direction is silently ignored');

-- teacher of school A ----------------------------------------------------------------
select pg_temp.login(:teacher_ps);
select is((select count(*) from public.classes where id = :class_b), 0::bigint, 'a teacher of school A does not see a class of school B');
select is((select count(*) from public.class_appointments(:class_b)), 0::bigint, 'appointments of a school B class are hidden from a school A teacher');

-- direction of school B --------------------------------------------------------------
select pg_temp.login(:admin_b);
select is((select string_agg(slug, ',') from public.schools), 'ecole-test-b', 'direction of school B sees only school B');
select is((select count(*) from public.students), 1::bigint, 'direction of school B sees only its own pupil');
select is((select count(*) from public.announcements where school_id = :school_a), 0::bigint, 'direction of school B sees no announcement of the demo school');
select is((select count(*) from public.profiles where id = :admin_a), 0::bigint, 'the profile of the demo school direction is invisible from school B');
select lives_ok(format('select public.ensure_class_threads(%L)', :class_b), 'direction of school B can create the threads of its own class');
select is((select count(*) from public.class_directory(:class_ps)), 0::bigint, 'the directory of a demo school class is empty for school B direction');
select throws_ok(format('select public.publish_assessments(%L, %L)', :class_ps, :period_a), null, null, 'school B direction cannot publish assessments of a demo school class');
select throws_ok(format('insert into public.students (school_id, family_id, first_name, last_name) values (%L, %L, %L, %L)', :school_a, :family_b, 'Intrus', 'A'), '42501', null, 'school B direction cannot create a pupil in the demo school');

-- parent of school B -----------------------------------------------------------------
select pg_temp.login(:parent_b);
select is((select count(*) from public.announcements), 1::bigint, 'parent of school B sees exactly the school B announcement');
select is((select count(*) from public.global_search('isolée')), 1::bigint, 'global search finds the own-school announcement');
select is((select count(*) from public.global_search('Bienvenue')), 0::bigint, 'global search hides the demo school announcements');
select throws_ok(format('select public.book_appointment(%L, %L)', :slot_a, :student_b), null, null, 'a parent of school B cannot book a slot of the demo school');
select token as feed_token_b from public.my_calendar_feed() \gset
select is((select count(*) from public.calendar_feed_events(:'feed_token_b') where id = :event_a), 0::bigint, 'the ICS feed of a school B parent carries no demo school event');
select is((select count(*) from public.calendar_feed_events(:'feed_token_b') where id = :event_b), 1::bigint, 'the ICS feed of a school B parent carries its own school event');

-- platform super admin ------------------------------------------------------------------
select pg_temp.login(:superadmin);
select is((select count(*) from public.schools), 2::bigint, 'the platform super admin sees both schools');

select * from finish();
rollback;
