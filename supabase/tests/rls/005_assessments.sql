-- pgTAP: assessments (session 11) — teacher entry limited to their classes, parent visibility
-- only after publication and with the can_view_grades flag, staff and guardians excluded,
-- remarks, publication function with family notification.
begin;
select plan(17);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_ms '''00000000-0000-4000-8000-000000000515'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set guardian18 '''c0000000-0000-4000-8000-000000180003'''
\set maya '''d0000000-0000-4000-8000-000000010001'''
\set romy '''d0000000-0000-4000-8000-000000180001'''
\set period1 '''00000000-0000-4000-8000-000000000769'''
\set period2 '''00000000-0000-4000-8000-000000000770'''
\set skill_ps '''00000000-0000-4000-8000-000000001025'''
\set skill_ms '''00000000-0000-4000-8000-000000001046'''

-- teacher entry ----------------------------------------------------------------------------
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into public.assessments (school_id, class_id, student_id, teacher_id, period_id, skill_id, level)
          values (%L, %L, %L, %L, %L, %L, 'acquired')$$, :school, :class_ps, :maya, :teacher_ps, :period2, :skill_ps),
  'a teacher assesses a student of their class'
);
select throws_ok(
  format($$insert into public.assessments (school_id, class_id, student_id, teacher_id, period_id, skill_id, level)
          values (%L, %L, %L, %L, %L, %L, 'acquired')$$, :school, :class_ms, :romy, :teacher_ps, :period2, :skill_ms),
  '42501', null, 'a teacher cannot assess another class'
);
select lives_ok(
  format($$insert into public.assessment_remarks (school_id, class_id, student_id, period_id, teacher_id, body)
          values (%L, %L, %L, %L, %L, 'Belle période.')$$, :school, :class_ps, :maya, :period2, :teacher_ps),
  'a teacher writes a period remark'
);

-- visibility before publication -----------------------------------------------------------
select pg_temp.login(:parent1);
select is((select count(*) from public.assessments where student_id = :maya and period_id = :period1), 21::bigint, 'parents see the published period of their child');
select is((select count(*) from public.assessments where student_id = :maya and period_id = :period2), 0::bigint, 'unpublished assessments stay hidden');
select is((select count(*) from public.assessment_remarks where student_id = :maya), 0::bigint, 'remarks stay hidden until publication');
select throws_ok(format('select public.publish_assessments(%L, %L)', :class_ps, :period2), '42501', null, 'parents cannot publish');

select pg_temp.login(:staff);
select is((select count(*) from public.assessments), 0::bigint, 'the secretariat never sees assessments');

select pg_temp.login(:guardian18);
select is((select count(*) from public.assessments), 0::bigint, 'read-only guardians never see assessments');

-- publication ---------------------------------------------------------------------------
select pg_temp.login(:teacher_ps);
select throws_ok(format('select public.publish_assessments(%L, %L)', :class_ms, :period2), '42501', null, 'a teacher cannot publish another class');
select is(public.publish_assessments(:class_ps, :period2), 1, 'publishing returns the number of newly visible assessments');
select is(public.publish_assessments(:class_ps, :period2), 0, 'publishing is idempotent');

select pg_temp.login(:parent1);
select is((select count(*) from public.assessments where student_id = :maya and period_id = :period2), 1::bigint, 'parents see the assessments once published');
select is((select count(*) from public.assessment_remarks where student_id = :maya and period_id = :period2), 1::bigint, 'parents read the remark once published');
select is(
  (select count(*) from public.notifications where kind = 'assessment.published' and payload->>'student_id' = :maya and payload->>'period_id' = :period2),
  1::bigint, 'families are notified of the publication'
);

-- independent guardian rights --------------------------------------------------------------
select pg_temp.login(:admin);
select lives_ok(
  format($$update public.student_guardians set can_view_grades = false where student_id = %L and user_id = %L$$, :maya, :parent1),
  'admin withdraws the grades right of one guardian'
);
select pg_temp.login(:parent1);
select is((select count(*) from public.assessments where student_id = :maya), 0::bigint, 'a guardian without the grades right sees nothing');

select * from finish();
rollback;
