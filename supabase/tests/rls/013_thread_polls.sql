-- pgTAP: polls inside a conversation — who may ask, who may answer, what closing does.
begin;
select plan(13);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set teacher_ms '''b0000000-0000-4000-8000-000000000003'''

-- the class group and its official channel
select pg_temp.login(:teacher_ps);
select public.ensure_class_threads(:class_ps);

create temporary table t_ids on commit drop as
select
  (select id from public.threads where class_id = :class_ps and kind = 'class_group') as grp,
  (select id from public.threads where class_id = :class_ps and kind = 'class_official') as official;

-- ── the teacher asks the class group ─────────────────────────────────────────
select lives_ok(
  format($$select public.create_thread_poll((select grp from t_ids), 'Qui accompagne la sortie ?', array['Oui', 'Non', 'Peut-être'])$$),
  'a teacher opens a poll in the class group');

create temporary table t_poll on commit drop as
select id, message_id from public.thread_polls where question = 'Qui accompagne la sortie ?';

select is((select count(*) from t_poll), 1::bigint, 'the poll exists');
select isnt((select message_id from t_poll), null,
  'it is announced by a real message, so the thread shows it');
select is(
  (select body from public.messages where id = (select message_id from t_poll)),
  'Qui accompagne la sortie ?', 'and that message carries the question');

-- ── a parent of the class answers ────────────────────────────────────────────
select pg_temp.login(:parent1);
select lives_ok(
  format($$select public.vote_in_poll((select id from t_poll), array[0]::smallint[])$$),
  'a parent of the class votes');
select is(
  (select count(*) from public.poll_votes where poll_id = (select id from t_poll)),
  1::bigint, 'the vote is recorded');

-- changing your mind replaces the answer instead of adding one
select lives_ok(
  format($$select public.vote_in_poll((select id from t_poll), array[2]::smallint[])$$),
  'a parent may change their mind');
select is(
  (select option_index from public.poll_votes
   where poll_id = (select id from t_poll) and user_id = :parent1),
  2::smallint, 'and only the last answer stands');

select throws_ok(
  format($$select public.vote_in_poll((select id from t_poll), array[0, 1]::smallint[])$$),
  '23514', null, 'a single-choice poll refuses two answers');
select throws_ok(
  format($$select public.vote_in_poll((select id from t_poll), array[9]::smallint[])$$),
  '23514', null, 'an option that does not exist is refused');

-- ── outsiders ────────────────────────────────────────────────────────────────
select pg_temp.login(:teacher_ms);
select throws_ok(
  format($$select public.vote_in_poll((select id from t_poll), array[0]::smallint[])$$),
  '42501', null, 'someone outside the thread cannot vote');

-- ── an announcement channel takes no polls from its readers ──────────────────
select pg_temp.login(:parent1);
select throws_ok(
  format($$select public.create_thread_poll((select official from t_ids), 'Question ?', array['A', 'B'])$$),
  '42501', null, 'a reader cannot open a poll in a channel that forbids replies');

-- ── closing ──────────────────────────────────────────────────────────────────
select pg_temp.login(:teacher_ps);
select lives_ok(format($$select public.close_poll((select id from t_poll))$$),
  'the author closes the poll');

select * from finish();
rollback;
