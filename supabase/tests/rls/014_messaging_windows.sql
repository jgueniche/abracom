-- pgTAP: the direction's tap on parent → school messaging (session 19, chantier A).
-- A closed channel must be refused by the database, not merely hidden by a screen:
-- every case below ends on a real INSERT into public.messages.
begin;
select plan(30);

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
\set class_ps '''00000000-0000-4000-8000-000000000513'''
\set class_ms '''00000000-0000-4000-8000-000000000515'''
\set group_ps '''00000000-0000-4000-8000-000000003089'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000001'''
\set parent '''c0000000-0000-4000-8000-000000060001'''
\set child '''d0000000-0000-4000-8000-000000060001'''

-- Counted against a baseline rather than an absolute: an exploration session on
-- the stack may already have left `messaging.mode` rows behind.
select
  (select count(*) from public.audit_log where action = 'messaging.mode') as modes_before,
  (select count(*) from public.audit_log where action = 'thread.override') as overrides_before
\gset

-- ── an open school lets a parent speak ───────────────────────────────────────
select pg_temp.login(:parent);
select ok(public.can_post_in_thread(:group_ps, :parent), 'by default the class channel is open');
select is(
  (public.thread_messaging_state(:group_ps, :parent) ->> 'closesAt'),
  null, 'an unrestricted school promises no closing time');
select lives_ok(
  format($$insert into public.messages (thread_id, author_id, body) values (%L, %L, 'Bonjour')$$, :group_ps, :parent),
  'and the database accepts the message');

-- ── the direction shuts it ───────────────────────────────────────────────────
select pg_temp.login(:admin);
select lives_ok(
  format($$select public.set_messaging_mode(%L, 'closed', array['teachers'], 'Secrétariat : 01 00 00 00 00')$$, :school),
  'the direction closes parent → teachers');
select is(
  (select modules -> 'messaging' ->> 'parentToStaff' from public.schools where id = :school),
  'closed', 'the switch is stored on the school');
select is(
  (select count(*) from public.audit_log where action = 'messaging.mode' and school_id = :school)
    - :modes_before,
  1::bigint, 'closing the channel is audited');

select pg_temp.login(:parent);
select ok(not public.can_post_in_thread(:group_ps, :parent), 'the parent may no longer post');
select throws_ok(
  format($$insert into public.messages (thread_id, author_id, body) values (%L, %L, 'Toujours là ?')$$, :group_ps, :parent),
  '42501', null, 'and the row-level policy refuses the INSERT');
select is(
  (select (public.thread_messaging_state(:group_ps, :parent) ->> 'reopensAt')),
  null, 'no reopening date is promised when none was entered');

-- the team keeps writing while the families are muted: that is the whole point
select pg_temp.login(:teacher_ps);
select ok(public.can_post_in_thread(:group_ps, :teacher_ps), 'the teacher still writes to the class');
-- and the closure only bites on the audience the direction picked (arbitrage 2)
select ok(public.messaging_is_open(:school, 'direction'),
  'closing the teachers leaves the office open');

-- ── a window while the school is "scheduled" ─────────────────────────────────
select pg_temp.login(:admin);
select lives_ok(
  format($$select public.set_messaging_mode(%L, 'scheduled', array['teachers'], null)$$, :school),
  'the direction switches to scheduled openings');
select lives_ok(
  format($$insert into public.messaging_windows (school_id, scope, kind, opens_at, closes_at, created_by, note)
           values (%L, 'teachers', 'open', now() - interval '1 hour', now() + interval '1 hour', %L, 'permanence du mardi')$$,
         :school, :admin),
  'and opens a window that is running now');
select pg_temp.login(:parent);
select ok(public.can_post_in_thread(:group_ps, :parent), 'inside the window the parent speaks again');
-- the composer says when it shuts, and only ever from a stored period
select isnt(
  (public.thread_messaging_state(:group_ps, :parent) ->> 'closesAt'),
  null, 'the running period tells the parent when it shuts');
select lives_ok(
  format($$insert into public.messages (thread_id, author_id, body) values (%L, %L, 'Pendant la permanence')$$, :group_ps, :parent),
  'and the INSERT is accepted');

-- the same window, once it has passed
select pg_temp.login(:admin);
update public.messaging_windows set opens_at = now() - interval '3 days', closes_at = now() - interval '2 days';
select pg_temp.login(:parent);
select ok(not public.can_post_in_thread(:group_ps, :parent), 'a window that has passed closes the channel again');
select throws_ok(
  format($$insert into public.messages (thread_id, author_id, body) values (%L, %L, 'Trop tard')$$, :group_ps, :parent),
  '42501', null, 'the INSERT is refused after the window');

-- a future window is the one date the parent may be shown (arbitrage 4)
select pg_temp.login(:admin);
update public.messaging_windows set opens_at = now() + interval '2 days', closes_at = now() + interval '2 days 2 hours';
select pg_temp.login(:parent);
select isnt(
  (public.thread_messaging_state(:group_ps, :parent) ->> 'reopensAt'),
  null, 'a scheduled opening gives the parent a reopening date');

-- ── a closing period over a school that is otherwise open ────────────────────
select pg_temp.login(:admin);
delete from public.messaging_windows;
select public.set_messaging_mode(:school, 'open', array['teachers'], null);
insert into public.messaging_windows (school_id, scope, kind, opens_at, closes_at, created_by, note)
values (:school, 'all', 'closed', now() - interval '1 day', now() + interval '10 days', :admin, 'du 15 au 30 juin');
select pg_temp.login(:parent);
select ok(not public.can_post_in_thread(:group_ps, :parent), 'a closing period beats an open school');
select isnt(
  (public.thread_messaging_state(:group_ps, :parent) ->> 'reopensAt'),
  null, 'and the end of the period is the reopening date');

-- one class only: the neighbouring class is untouched
select pg_temp.login(:admin);
delete from public.messaging_windows;
insert into public.messaging_windows (school_id, scope, kind, class_id, opens_at, closes_at, created_by)
values (:school, 'teachers', 'closed', :class_ps, now() - interval '1 hour', now() + interval '1 hour', :admin);
select ok(not public.messaging_is_open(:school, 'teachers', :class_ps), 'the class named by the period is closed');
select ok(public.messaging_is_open(:school, 'teachers', :class_ms), 'its neighbour keeps its channel');

-- ── a teacher reopens their own channel (arbitrage 3, ADR-0038) ──────────────
select pg_temp.login(:admin);
delete from public.messaging_windows;
select public.set_messaging_mode(:school, 'closed', array['teachers'], null);
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$select public.set_thread_replies(%L, null, true)$$, :group_ps),
  'the class teacher may reopen their own channel');
select pg_temp.login(:parent);
select ok(public.can_post_in_thread(:group_ps, :parent), 'the families of that class write again');
select pg_temp.login(:admin);
select is(
  (select count(*) from public.audit_log where action = 'thread.override')
    - :overrides_before,
  1::bigint, 'the derogation is traced for the direction');
select ok(
  (select override from public.messaging_channels(:school) where thread_id = :group_ps),
  'and it shows on the pilot screen');

-- ── an individually blocked guardian is closed whatever the school says ──────
select pg_temp.login(:admin);
select public.set_messaging_mode(:school, 'open', array['teachers'], null);
select public.set_thread_replies(:group_ps, null, false);
update public.student_guardians set can_message = false where user_id = :parent and student_id = :child;
select pg_temp.login(:parent);
select ok(not public.can_post_in_thread(:group_ps, :parent),
  'a guardian whose messaging right was withdrawn stays closed on an open school');

-- ── who may read and write the periods ───────────────────────────────────────
select pg_temp.login(:parent);
select is((select count(*)::int from public.messaging_windows), 0,
  'a parent sees no window at all');
select throws_ok(
  format($$select public.messaging_load(%L, 8)$$, :school),
  '42501', null, 'and cannot read the message load of the school');

select * from finish();
rollback;
