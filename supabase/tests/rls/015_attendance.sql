-- pgTAP: la pointeuse (session 19, chantier B).
-- The safety point of the whole feature is the last block: a guardian under a
-- judicial restriction can never be recorded as collecting the child.
begin;
select plan(39);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000003'''
-- Ethan Saada: two guardians, the second under a judicial restriction.
\set child '''d0000000-0000-4000-8000-000000440001'''
\set guardian_ok '''c0000000-0000-4000-8000-000000440001'''
\set guardian_blocked '''c0000000-0000-4000-8000-000000440002'''

-- ── the direction creates an after-school list ───────────────────────────────
select pg_temp.login(:admin);
select lives_ok(
  format($$insert into public.attendance_lists (school_id, kind, name, code, class_ids, weekdays, records_pickup, visible_to_guardians, created_by)
           values (%L, 'service', 'Périscolaire de test', 'garderie_test', array[%L]::uuid[], array[1,2,4,5]::smallint[], true, true, %L)$$,
         :school, :class_ps, :admin),
  'the direction opens an after-school list');

create temporary table t_list on commit drop as
select id from public.attendance_lists where code = 'garderie_test';
select is((select count(*) from t_list), 1::bigint, 'exactly one list was created');

-- the roster is the classes it names, not the whole school
select is(
  (select count(*) from public.attendance_list_students((select id from t_list))),
  (select count(*) from public.enrollments e join public.students s on s.id = e.student_id
   where e.class_id = :class_ps and e.left_on is null and s.status = 'active'),
  'the roster is the class the list names');

-- ── the evening supervisor is granted the list, and nothing else ─────────────
select lives_ok(
  format($$insert into public.attendance_list_managers (list_id, user_id, added_by)
           values ((select id from t_list), %L, %L)$$, :staff, :admin),
  'the direction grants the list to one person');

select pg_temp.login(:staff);
select ok(public.attendance_can_manage((select id from t_list), :staff),
  'the person granted the list may point on it');
select is(
  (select count(*) from public.attendance_lists where id = (select id from t_list)),
  1::bigint, 'and sees that list');

-- a teacher who was granted nothing may not point on a service list
select pg_temp.login(:teacher_ps);
select ok(not public.attendance_can_manage((select id from t_list), :teacher_ps),
  'a teacher has no right on an after-school list they were not given');
select throws_ok(
  format($$select public.open_attendance_session((select id from t_list))$$),
  '42501', null, 'and cannot open its occurrence');

-- ── pointing ────────────────────────────────────────────────────────────────
select pg_temp.login(:staff);
select lives_ok(
  format($$select public.open_attendance_session((select id from t_list))$$),
  'the supervisor opens today''s occurrence');
create temporary table t_session on commit drop as
select id from public.attendance_sessions where list_id = (select id from t_list);
select is((select count(*) from t_session), 1::bigint, 'one occurrence for the day');
select is(
  (select public.open_attendance_session((select id from t_list))),
  (select id from t_session), 'opening it twice returns the same occurrence');

select lives_ok(
  format($$select public.mark_attendance((select id from t_session), %L, 'present')$$, :child),
  'a tap marks the child present');
select is(
  (select status::text from public.attendance_records
   where session_id = (select id from t_session) and student_id = :child),
  'present', 'the record says present');
select isnt(
  (select arrived_at from public.attendance_records
   where session_id = (select id from t_session) and student_id = :child),
  null, 'and carries the time of arrival');

-- a second tap undoes the first, through its own verb: an omitted status on
-- `mark_attendance` falls back on 'present', which would re-mark the child
select lives_ok(
  format($$select public.clear_attendance((select id from t_session), %L)$$, :child),
  'a second tap clears the record');
select is(
  (select count(*) from public.attendance_records where session_id = (select id from t_session)),
  0::bigint, 'nothing is left of it');
-- the trap the screen fell into: an omitted status marks the child present
select lives_ok(
  format($$select public.mark_attendance((select id from t_session), %L)$$, :child),
  'calling mark_attendance without a status still marks the child');
select is(
  (select status::text from public.attendance_records
   where session_id = (select id from t_session) and student_id = :child),
  'present', 'which is why clearing has a verb of its own');
select lives_ok(
  format($$select public.clear_attendance((select id from t_session), %L)$$, :child),
  'and the record is cleared again for what follows');

-- the roster carries a family-declared absence, without creating one (arbitrage 8)
select pg_temp.login(:guardian_ok);
insert into public.absences (school_id, student_id, declared_by, kind, starts_on, ends_on)
values (:school, :child, :guardian_ok, 'absence', current_date, current_date);
select pg_temp.login(:staff);
select ok(
  (select declared_absent from public.attendance_roster((select id from t_session)) where student_id = :child),
  'the roster shows a child their family declared absent');
select is(
  (select count(*) from public.absences where student_id = :child),
  1::bigint, 'and pointing created no absence of its own');

-- ── who collects the child ──────────────────────────────────────────────────
select lives_ok(
  format($$select public.mark_attendance((select id from t_session), %L, 'present', now(), true, %L)$$,
         :child, :guardian_ok),
  'an authorised guardian may be recorded as collecting the child');
select is(
  (select pickup_user_id from public.attendance_records
   where session_id = (select id from t_session) and student_id = :child),
  :guardian_ok::uuid, 'the record names them');
select isnt(
  (select departed_at from public.attendance_records
   where session_id = (select id from t_session) and student_id = :child),
  null, 'and the departure is timed');

-- THE safety assertion: a judicial restriction closes the door in the database
select throws_ok(
  format($$select public.mark_attendance((select id from t_session), %L, 'present', now(), true, %L)$$,
         :child, :guardian_blocked),
  '42501', null,
  'a guardian under a judicial restriction can never be recorded as collecting the child');
select is(
  (select count(*) from public.attendance_pickup_options(:child)),
  1::bigint, 'and is not even offered among the options');

-- someone who is no guardian at all is refused too
select throws_ok(
  format($$update public.attendance_records set pickup_user_id = %L
           where session_id = (select id from t_session) and student_id = %L$$, :staff, :child),
  '42501', null, 'and neither is a person who is not a guardian of this child');

-- a child who is not on the list cannot be pointed
select throws_ok(
  format($$select public.mark_attendance((select id from t_session), %L, 'present')$$,
         '00000000-0000-4000-8000-0000000009ff'),
  null, null, 'a child who is not on the list is refused');

-- ── closing, and correcting afterwards ──────────────────────────────────────
select lives_ok(
  format($$select public.close_attendance_session((select id from t_session))$$),
  'the supervisor closes the service');
select isnt((select closed_at from t_session join public.attendance_sessions s on s.id = t_session.id),
  null, 'the occurrence is closed');
select lives_ok(
  format($$select public.mark_attendance((select id from t_session), %L, 'late')$$, :child),
  'a correction after closing is still possible');
-- the journal is the direction's alone (ADR-0035), so read it as the direction
select pg_temp.login(:admin);
select is(
  (select count(*) from public.audit_log where action = 'attendance.correct'),
  1::bigint, 'and it lands in the audit log');

-- ── what the family sees (arbitrage 5) ──────────────────────────────────────
select pg_temp.login(:guardian_ok);
select is(
  (select count(*) from public.child_attendance(:child, 14)),
  1::bigint, 'a guardian follows their child at the after-school club');
select throws_ok(
  format($$select public.attendance_roster((select id from t_session))$$),
  '42501', null, 'but never opens the pointing grid');

-- the roll call of a class stays inside the team
select pg_temp.login(:admin);
insert into public.attendance_lists (school_id, kind, name, class_id, records_pickup, visible_to_guardians, created_by)
values (:school, 'class_roll', 'Appel de test', :class_ps, false, false, :admin);
create temporary table t_roll on commit drop as
select id from public.attendance_lists where name = 'Appel de test';
select lives_ok(
  format($$select public.open_attendance_session((select id from t_roll))$$),
  'the roll call opens for the direction');
select lives_ok(
  format($$select public.mark_attendance(
    (select id from public.attendance_sessions where list_id = (select id from t_roll)), %L, 'present')$$, :child),
  'and the child is pointed on it');
-- the evening supervisor was given the after-school list, not the roll call
select pg_temp.login(:staff);
select ok(not public.attendance_can_manage((select id from t_roll), :staff),
  'the evening supervisor has no right on the classroom roll call');
select pg_temp.login(:guardian_ok);
select is(
  (select count(*) from public.child_attendance(:child, 14)),
  1::bigint, 'the family still sees only the after-school club, never the roll call');

-- the blocked guardian sees nothing of this child at all
select pg_temp.login(:guardian_blocked);
select throws_ok(
  format($$select public.child_attendance(%L, 14)$$, :child),
  '42501', null, 'the blocked guardian reaches nothing of this child');

select * from finish();
rollback;
