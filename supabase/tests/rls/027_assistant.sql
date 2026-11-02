-- pgTAP : l'assistant (ADR-0088). La base ne garde qu'un compte de questions par personne et
-- par jour ; personne ne le fait avancer pour un autre, personne ne lit celui d'un autre, et
-- la soixante et unième question du jour est refusée.
begin;
select plan(11);

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

\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set other_parent '''c0000000-0000-4000-8000-000000100001'''

select ok((select relrowsecurity from pg_class where oid = 'public.assistant_usage'::regclass),
  'the assistant''s counts are under row level security');
select hasnt_column('public', 'assistant_usage', 'question',
  'no column keeps what was asked');

select pg_temp.login(:parent1);
select is(public.assistant_take_question(), true, 'a parent asks a first question');
select is((select questions from public.assistant_usage where user_id = :parent1), 1,
  'and reads their own count');
select throws_ok(
  format($$insert into public.assistant_usage (user_id, day, questions) values (%L, current_date + 1, 0)$$, :other_parent),
  '42501', null, 'nobody writes a count by hand, for themselves or anyone');
update public.assistant_usage set questions = 0 where user_id = :parent1;
select pg_temp.owner();
select is((select questions from public.assistant_usage where user_id = :parent1), 1,
  'a parent cannot reset their own count');

select pg_temp.login(:other_parent);
select is((select count(*) from public.assistant_usage where user_id = :parent1), 0::bigint,
  'another parent reads nothing of it');

select pg_temp.owner();
update public.assistant_usage set questions = 59 where user_id = :parent1;
select pg_temp.login(:parent1);
select is(public.assistant_take_question(), true, 'the sixtieth question of the day is answered');
select is(public.assistant_take_question(), false, 'the sixty-first is not');
select pg_temp.owner();
select is((select questions from public.assistant_usage where user_id = :parent1), 60,
  'and the count stays at the ceiling');

set local role anon;
select throws_ok($$select public.assistant_take_question()$$, '42501', null,
  'nobody signed out asks the assistant');
reset role;

select * from finish();
rollback;
