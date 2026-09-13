-- pgTAP: the person's own door on direct messages from families (session 29,
-- ADR-0060). The switch must be enforced by the database — a screen that hides
-- a name is not a rule — and it must never reach between colleagues.
begin;
select plan(15);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000001'''
\set teacher_ms '''b0000000-0000-4000-8000-000000000002'''
\set parent '''c0000000-0000-4000-8000-000000060001'''

-- ── an open door is the default ──────────────────────────────────────────────
select is(
  (select accepts_parent_dm from public.profiles where id = :teacher_ps),
  true, 'a profile accepts direct messages from families by default');
select pg_temp.login(:parent);
select ok(public.can_direct_message(:teacher_ps, :parent),
  'a parent of the class may open a conversation with the teacher');

-- ── a conversation opened while the door was open ────────────────────────────
select public.open_dm(:teacher_ps) as dm \gset
select ok(public.can_post_in_thread(:'dm', :parent),
  'and may write in it');

-- ── the teacher closes her own door ──────────────────────────────────────────
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$update public.profiles set accepts_parent_dm = false where id = %L$$, :teacher_ps),
  'a teacher may close her own door');
select is(
  (select accepts_parent_dm from public.profiles where id = :teacher_ps),
  false, 'and the profile records it');

-- ...and cannot close anyone else's
select lives_ok(
  format($$update public.profiles set accepts_parent_dm = false where id = %L$$, :teacher_ms),
  'the statement on a colleague runs (RLS refuses rows, it does not raise)');
select is(
  (select accepts_parent_dm from public.profiles where id = :teacher_ms),
  true, 'but RLS wrote nothing on the colleague''s profile');

-- ── the family is refused, in the database ───────────────────────────────────
select pg_temp.login(:parent);
select ok(not public.can_direct_message(:teacher_ps, :parent),
  'the family can no longer open a conversation');
select ok(not exists (select 1 from public.dm_contacts() where user_id = :teacher_ps),
  'and the teacher has left the list of people they may write to');
select is(
  (public.thread_messaging_state(:'dm', :parent) ->> 'closedBy'),
  'person', 'the conversation says who closed it, not the school');
select ok(not public.can_post_in_thread(:'dm', :parent),
  'the conversation already open stops taking messages from the family');
select throws_ok(
  format($$insert into public.messages (thread_id, author_id, body) values (%L, %L, 'Bonjour')$$, :'dm', :parent),
  '42501', null, 'and the database refuses the INSERT');

-- ── colleagues are never blocked ─────────────────────────────────────────────
select pg_temp.login(:teacher_ms);
select ok(public.can_direct_message(:teacher_ps, :teacher_ms),
  'a colleague still reaches her');
select pg_temp.login(:admin);
select ok(public.can_direct_message(:teacher_ps, :admin),
  'so does the direction');
select ok(public.can_post_in_thread(:'dm', :teacher_ps) is not null,
  'and the teacher herself keeps writing in the conversation');

select * from finish();
rollback;
