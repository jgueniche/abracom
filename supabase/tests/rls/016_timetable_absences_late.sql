-- pgTAP: les trois écarts Educartable (session 20) — emploi du temps, mot
-- d'excuse signé du téléphone, suivi des retards.
begin;
select plan(31);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_ce1 '''00000000-0000-4000-8000-000000000518'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set teacher_other '''b0000000-0000-4000-8000-000000000006'''
\set child '''d0000000-0000-4000-8000-000000440001'''
\set guardian_ok '''c0000000-0000-4000-8000-000000440001'''
\set guardian_blocked '''c0000000-0000-4000-8000-000000440002'''
-- read-only guardian, of a child in CE1 Cèdres
\set readonly '''c0000000-0000-4000-8000-000000050003'''

-- ══ 1. L'emploi du temps ═══════════════════════════════════════════════════
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into public.class_timetable (school_id, class_id, weekday, starts_at, ends_at, subject, teacher_id, room, created_by)
           values (%L, %L, 2, '08:30', '09:30', 'Langage', %L, 'Salle 2', %L)$$,
         :school, :class_ps, :teacher_ps, :teacher_ps),
  'the class teacher writes a slot');

create temporary table t_slot on commit drop as
select id from public.class_timetable where class_id = :class_ps and subject = 'Langage';
select is((select count(*) from t_slot), 1::bigint, 'the slot exists');

-- a slot may only name someone who teaches this class
select throws_ok(
  format($$insert into public.class_timetable (school_id, class_id, weekday, starts_at, ends_at, subject, teacher_id, created_by)
           values (%L, %L, 3, '10:00', '11:00', 'Anglais', %L, %L)$$,
         :school, :class_ps, :teacher_other, :teacher_ps),
  '42501', null, 'a slot cannot name a teacher of another class');

-- the hours have to make sense
select throws_ok(
  format($$insert into public.class_timetable (school_id, class_id, weekday, starts_at, ends_at, subject, created_by)
           values (%L, %L, 3, '11:00', '10:00', 'Impossible', %L)$$,
         :school, :class_ps, :teacher_ps),
  '23514', null, 'a slot that ends before it starts is refused');

-- the families of the class read it
select pg_temp.login(:guardian_ok);
select is((select count(*) from public.class_timetable where class_id = :class_ps), 1::bigint,
  'a guardian of the class reads the timetable');
select is((select count(*) from public.class_week(:class_ps)), 1::bigint,
  'and through class_week, with the teacher resolved');
select is(
  (select teacher_name from public.class_week(:class_ps) limit 1),
  (select first_name || ' ' || last_name from public.profiles where id = :teacher_ps),
  'the slot names its teacher');
select throws_ok(
  format($$insert into public.class_timetable (school_id, class_id, weekday, starts_at, ends_at, subject, created_by)
           values (%L, %L, 4, '09:00', '10:00', 'Bricolage', %L)$$, :school, :class_ps, :guardian_ok),
  '42501', null, 'a parent does not write the timetable');

-- a read-only guardian is entitled to it (it is exactly what they may see)
select pg_temp.login(:readonly);
select is((select count(*) from public.class_timetable where class_id = :class_ps), 0::bigint,
  'a guardian of another class sees nothing of this one');
-- the office may write for any class of its school; the PS teacher may not
select pg_temp.login(:teacher_ps);
select throws_ok(
  format($$insert into public.class_timetable (school_id, class_id, weekday, starts_at, ends_at, subject, created_by)
           values (%L, %L, 2, '08:30', '09:30', 'Lecture', %L)$$, :school, :class_ce1, :teacher_ps),
  '42501', null, 'a teacher does not write the timetable of a class they do not teach');
select pg_temp.login(:staff);
insert into public.class_timetable (school_id, class_id, weekday, starts_at, ends_at, subject, created_by)
values (:school, :class_ce1, 2, '08:30', '09:30', 'Lecture', :staff);
select pg_temp.login(:readonly);
select is((select count(*) from public.class_timetable where class_id = :class_ce1), 1::bigint,
  'a read-only guardian reads the timetable of their own child''s class');

-- the office may fix it, and cannot move it to another school
select pg_temp.login(:staff);
select lives_ok(
  format($$update public.class_timetable set room = 'Salle 3' where id = (select id from t_slot)$$),
  'the office corrects a room');
select throws_ok(
  format($$update public.class_timetable set class_id = %L where id = (select id from t_slot)$$, :class_ce1),
  '42501', null, 'and cannot move a slot to another class');

-- ══ 2. Le mot d'excuse signé du téléphone ══════════════════════════════════
select pg_temp.login(:guardian_ok);
select lives_ok(
  format($$select public.declare_and_sign_absence(%L, 'absence', current_date, current_date,
             'Ethan a de la fièvre depuis cette nuit.', 'Sarah Saada', '203.0.113.4', 'Safari iPhone')$$,
         :child),
  'a guardian declares and signs in one gesture');

create temporary table t_abs on commit drop as
select id from public.absences where student_id = :child and starts_on = current_date;
select is((select count(*) from t_abs), 1::bigint, 'the absence is declared');
select is(
  (select status::text from public.absences where id = (select id from t_abs)),
  'declared', 'a signed note is submitted, never self-justified');
select is(
  (select signed_name from public.absence_justifications where absence_id = (select id from t_abs)),
  'Sarah Saada', 'the typed name is kept, as on a paper note');
select is(
  (select statement from public.absence_justifications where absence_id = (select id from t_abs)),
  'Ethan a de la fièvre depuis cette nuit.', 'and the family''s own words');

-- the hour is the database's, not the caller's
select pg_temp.login(:guardian_blocked);
select throws_ok(
  format($$insert into public.absence_justifications (absence_id, user_id, statement, signed_name)
           values ((select id from t_abs), %L, 'Rien', 'Personne')$$, :guardian_blocked),
  '42501', null, 'a guardian under a judicial restriction signs nothing');

select pg_temp.login(:readonly);
select throws_ok(
  format($$select public.declare_and_sign_absence(%L, 'absence', current_date, current_date, 'Mot', 'Nom')$$, :child),
  '42501', null, 'a read-only guardian declares nothing');
select is((select count(*) from public.absence_justifications), 0::bigint,
  'and reads no other family''s note');

-- backdating is impossible: the trigger stamps the hour itself
-- only the direction may remove a signature (a note filed by mistake)
select pg_temp.login(:staff);
select is((select count(*) from public.absence_justifications where absence_id = (select id from t_abs)),
  1::bigint, 'the office reads the note but cannot remove it');
select pg_temp.login(:admin);
delete from public.absence_justifications where absence_id = (select id from t_abs);
select pg_temp.login(:guardian_ok);
insert into public.absence_justifications (absence_id, user_id, statement, signed_name, signed_at)
values ((select id from t_abs), :guardian_ok, 'Deuxième mot', 'Sarah Saada', '2020-01-01');
select ok(
  (select signed_at from public.absence_justifications where absence_id = (select id from t_abs))
    > now() - interval '1 minute',
  'a backdated signature is stamped with the real hour');
-- There is no update policy at all, so the statement touches nothing rather
-- than raising: the guarantee is that the words cannot change, either way.
update public.absence_justifications set statement = 'réécrit' where absence_id = (select id from t_abs);
select is(
  (select statement from public.absence_justifications where absence_id = (select id from t_abs)),
  'Deuxième mot', 'and a signature is never rewritten');

-- the school still decides
select pg_temp.login(:guardian_ok);
select throws_ok(
  format($$update public.absences set status = 'justified' where id = (select id from t_abs)$$),
  '42501', null, 'the family cannot grant itself a justification');
select pg_temp.login(:staff);
select lives_ok(
  format($$update public.absences set status = 'justified', reviewed_by = %L, reviewed_at = now()
           where id = (select id from t_abs)$$, :staff),
  'the office grants it, having read the note');

-- ══ 3. Le suivi des retards ════════════════════════════════════════════════
select pg_temp.login(:guardian_ok);
select public.declare_and_sign_absence(:child, 'late', current_date - 1, current_date - 1,
  'Bus en retard.', 'Sarah Saada');

select pg_temp.login(:teacher_ps);
select is(
  (select declared_late from public.late_report(:school, current_date - 30, current_date, :class_ps)
   where student_id = :child),
  1::bigint, 'a lateness declared by the family is counted');
select throws_ok(
  format($$select public.late_report(%L, current_date - 30, current_date)$$, :school),
  '42501', null, 'a teacher does not read the whole school');

-- what the pointeuse saw counts too
select pg_temp.login(:admin);
insert into public.attendance_lists (id, school_id, kind, name, class_id, records_pickup, visible_to_guardians, created_by)
values ('00000000-0000-4000-8000-0000000019a1', :school, 'class_roll', 'Appel retards', :class_ps, false, false, :admin);
select public.open_attendance_session('00000000-0000-4000-8000-0000000019a1'::uuid, current_date - 2);
select public.mark_attendance(
  (select id from public.attendance_sessions where list_id = '00000000-0000-4000-8000-0000000019a1'),
  :child, 'late');
select is(
  (select observed_late from public.late_report(:school, current_date - 30, current_date, :class_ps)
   where student_id = :child),
  1::bigint, 'a lateness seen by the pointeuse is counted too');
select is(
  (select count(*) from public.late_report(:school, current_date - 30, current_date, :class_ps)),
  1::bigint, 'and pupils who were never late are left out');

select pg_temp.login(:guardian_ok);
select throws_ok(
  format($$select public.late_report(%L, current_date - 30, current_date, %L)$$, :school, :class_ps),
  '42501', null, 'a parent reads no lateness report at all');

select * from finish();
rollback;
