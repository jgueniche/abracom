-- pgTAP: discussion groups built from classes — who may create one, who lands in it.
begin;
select plan(12);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_ms '''00000000-0000-4000-8000-000000000515'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''

-- ── the direction builds a group across two classes ──────────────────────────
select pg_temp.login(:admin);
select lives_ok(
  format($$select public.create_group_thread('Sortie au musée', array[%L, %L]::uuid[])$$, :class_ps, :class_ms),
  'the direction creates a group from two classes');

create temporary table t_group on commit drop as
select id from public.threads where kind = 'custom' and title = 'Sortie au musée';
select is((select count(*) from t_group), 1::bigint, 'exactly one group was created');

select is(
  (select allow_replies from public.threads where id = (select id from t_group)),
  true, 'a group is a conversation, not an announcement');

-- every guardian of every pupil enrolled in either class is a member
select is(
  (select count(*) from public.thread_members where thread_id = (select id from t_group)),
  (select count(*) from (
     select distinct sg.user_id
     from public.enrollments e
     join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
     join public.memberships m on m.user_id = sg.user_id and m.school_id = :school
       and m.status = 'active' and m.role = 'parent'
     where e.class_id in (:class_ps, :class_ms)
       and (e.left_on is null or e.left_on >= current_date)
     union
     select ct.user_id from public.class_teachers ct where ct.class_id in (:class_ps, :class_ms)
     union
     select :admin::uuid
   ) as expected),
  'both classes'' guardians, their teachers and the author are in');

select is(
  (select role::text from public.thread_members
   where thread_id = (select id from t_group) and user_id = :admin),
  'moderator', 'the author moderates the group they created');

select is(
  (select count(*) from public.thread_members tm
   join public.class_teachers ct on ct.user_id = tm.user_id and ct.class_id = :class_ps
   where tm.thread_id = (select id from t_group) and tm.role <> 'moderator'),
  0::bigint, 'the classes'' teachers moderate it too');

-- ── a teacher is limited to the classes they teach ───────────────────────────
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$select public.create_group_thread('Projet jardin', array[%L]::uuid[])$$, :class_ps),
  'a teacher creates a group for their own class');
select throws_ok(
  format($$select public.create_group_thread('Projet voisin', array[%L]::uuid[])$$, :class_ms),
  '42501', null, 'a teacher cannot address a class they do not teach');
select is(
  (select count(*) from public.group_target_classes()),
  1::bigint, 'a teacher is only offered their own classes');

-- ── a parent creates nothing but direct messages ─────────────────────────────
select pg_temp.login(:parent1);
select throws_ok(
  format($$select public.create_group_thread('Entre parents', array[%L]::uuid[])$$, :class_ps),
  '42501', null, 'a parent cannot create a group');
select is((select count(*) from public.group_target_classes()), 0::bigint,
  'and is offered no class to build one from');

-- but they do see the group that was built for them
select is(
  (select count(*) from public.threads where kind = 'custom' and title = 'Sortie au musée'),
  1::bigint, 'a guardian of the class sees the group they were added to');

select * from finish();
rollback;
