-- pgTAP: what `student_guardians` gives a teacher, and why the application must
-- filter it (session 29).
--
-- `getMyChildren()` asked the database for "the guardian links I may read" and
-- treated the answer as "my own children". For a parent the two coincide; for a
-- teacher they do not at all — she may read the guardians of every pupil in her
-- class, so the cahier de texte offered her a filter chip and a "vu" button per
-- pupil, each first name repeated once per guardian. The rule below is the one
-- the application now relies on: RLS is a ceiling, not a filter.
begin;
select plan(4);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

\set teacher_ps '''b0000000-0000-4000-8000-000000000001'''
\set parent '''c0000000-0000-4000-8000-000000060001'''

select pg_temp.login(:teacher_ps);
select cmp_ok(
  (select count(*) from public.student_guardians sg where sg.user_id <> :teacher_ps),
  '>', 0::bigint,
  'a teacher reads guardian links that are not hers — RLS is a ceiling, not a filter');
select is(
  (select count(*) from public.student_guardians sg where sg.user_id = :teacher_ps),
  0::bigint,
  'and none of them is her own: scoped by user_id, a teacher has no children here');

select pg_temp.login(:parent);
select cmp_ok(
  (select count(*) from public.student_guardians sg where sg.user_id = :parent),
  '>', 0::bigint,
  'a parent scoped the same way still finds their children');
select is(
  (select count(distinct sg.student_id) from public.student_guardians sg where sg.user_id = :parent),
  (select count(*) from public.student_guardians sg where sg.user_id = :parent),
  'and each child appears once, never once per guardian');

select * from finish();
rollback;
