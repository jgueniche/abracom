-- pgTAP: level promotion (session 15) — admin only, classes recreated at the next level,
-- students moved, leavers marked, previous year archived and still readable.
begin;
select plan(9);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set year_current '''00000000-0000-4000-8000-000000000016'''
\set year_next '''00000000-0000-4000-8000-000000000017'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set maya '''d0000000-0000-4000-8000-000000010001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_ce1 '''00000000-0000-4000-8000-000000000518'''
\set level_ps '''00000000-0000-4000-8000-000000000258'''
\set level_ms '''00000000-0000-4000-8000-000000000259'''

select is(public.next_level_id(:level_ps), :level_ms::uuid, 'the next level follows the sort order');

select pg_temp.login(:admin);
insert into public.school_years (id, school_id, label, starts_on, ends_on, is_current)
values (:year_next, :school, '2027-2028', '2027-09-01', '2028-07-06', false);

select pg_temp.login(:parent1);
select throws_ok(
  format($$select public.promote_school_year(%L, %L, '[]'::jsonb)$$, :year_current, :year_next),
  '42501', null, 'parents cannot promote a school year'
);

select pg_temp.login(:admin);
select lives_ok(
  format($$select public.promote_school_year(%L, %L, jsonb_build_array(
    jsonb_build_object('class_id', %L, 'target_level_id', %L, 'name', 'MS Tournesols'),
    jsonb_build_object('class_id', %L, 'target_level_id', null, 'name', null)
  ))$$, :year_current, :year_next, :class_ps, :level_ms, :class_ce1),
  'admin promotes PS to MS and lets CE1 leave'
);
select is((select count(*) from public.classes where school_year_id = :year_next), 1::bigint, 'one class is created in the next year');
select is((select level_id from public.classes where school_year_id = :year_next), :level_ms::uuid, 'the new class carries the next level');
select ok(exists (select 1 from public.enrollments e join public.classes c on c.id = e.class_id where e.student_id = :maya and c.school_year_id = :year_next), 'students are enrolled in the new class');
select is((select count(*) from public.students s join public.enrollments e on e.student_id = s.id where e.class_id = :class_ce1 and s.status = 'left'), (select count(*) from public.enrollments where class_id = :class_ce1), 'students of the last level leave the school');
select is((select is_current from public.school_years where id = :year_next), true, 'the next year becomes current');
select is((select archived from public.classes where id = :class_ps), true, 'the previous class is archived');

select * from finish();
rollback;
