-- pgTAP: rules added by the hardening migrations (20260908172400 / 172500).
begin;
select plan(36);

create or replace function pg_temp.login(uid uuid, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', aal)::text, true);
end $$;

create or replace function pg_temp.owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_cp '''00000000-0000-4000-8000-000000000517'''
\set level_ps '''00000000-0000-4000-8000-000000000258'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set teacher_ms '''b0000000-0000-4000-8000-000000000003'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set parent1_b '''c0000000-0000-4000-8000-000000010002'''
\set parent7 '''c0000000-0000-4000-8000-000000070001'''
\set maya '''d0000000-0000-4000-8000-000000010001'''
\set guardian18 '''c0000000-0000-4000-8000-000000180003'''
\set student18 '''d0000000-0000-4000-8000-000000180001'''
\set group_ps '''00000000-0000-4000-8000-000000003090'''
\set official_ps '''00000000-0000-4000-8000-000000003074'''
\set event_school '''00000000-0000-4000-8000-000000002049'''

-- ── two-factor sessions ────────────────────────────────────────────────────────
select pg_temp.login(:admin, 'aal1');
select is(public.is_school_admin(:school), false, 'an administrator without a two-factor session holds no admin right');
select is((select count(*) from public.audit_log), 0::bigint, 'the audit log is hidden from an aal1 administrator session');
select is((select count(*) from public.announcements), (select count(*) from public.announcements where published_at <= now() and deleted_at is null), 'the aal1 session still reads what any member reads');
select pg_temp.login(:admin);
select is(public.is_school_admin(:school), true, 'the same administrator with aal2 holds the right');
select ok((select count(*) from public.audit_log) > 0, 'and reads the audit log');

-- ── helpers answering about other users ────────────────────────────────────────
select pg_temp.login(:parent1);
select is((select count(*) from public.guardian_class_ids(:parent7)), 0::bigint, 'a parent cannot list the classes of another parent');
select ok((select count(*) from public.guardian_class_ids(:parent1)) > 0, 'a parent still lists their own classes');
select pg_temp.login(:staff);
select ok((select count(*) from public.guardian_class_ids(:parent7)) > 0, 'the secretariat may inspect a parent of the school');

-- ── threads ────────────────────────────────────────────────────────────────────
select pg_temp.login(:parent1);
select throws_ok(
  format($$update public.thread_members set role = 'moderator' where thread_id = %L and user_id = %L$$, :group_ps, :parent1),
  '42501', null, 'a member cannot promote themselves to moderator');
select lives_ok(
  format($$update public.thread_members set muted = true where thread_id = %L and user_id = %L$$, :group_ps, :parent1),
  'a member can still mute a conversation');
select is(public.is_thread_moderator(:group_ps, :parent1), false, 'a parent is not a moderator of the class group');
select ok(public.is_thread_moderator(:group_ps, :teacher_ps), 'the class teacher moderates the class group');
select ok(public.is_thread_moderator(:group_ps, :staff), 'the secretariat moderates every thread of the school');
select public.open_dm(:teacher_ps) as dm \gset
select throws_ok(
  format($$insert into public.thread_members (thread_id, user_id) values (%L, %L)$$, :'dm', :parent1_b),
  '42501', null, 'nobody can add a third person to a direct message');
select ok(public.is_thread_moderator(:'dm', :parent1) = false, 'opening a direct message does not make its creator a moderator');
with m as (
  insert into public.messages (thread_id, author_id, body, moderated_by, moderation_reason, deleted_at)
  values (:'dm', :parent1, 'bonjour', :parent1, 'forgé', now()) returning id
)
select id as msg from m \gset
select is((select moderated_by from public.messages where id = :'msg'), null, 'moderation columns sent by a client are ignored');
select is((select deleted_at from public.messages where id = :'msg'), null, 'a client cannot post a pre-deleted message');
select throws_ok(
  format($$update public.messages set thread_id = %L where id = %L$$, :group_ps, :'msg'),
  '42501', null, 'a message cannot be moved to another thread');

-- messaging right withdrawn for one guardian
select pg_temp.owner();
update public.student_guardians set can_message = false where user_id = :parent1_b;
select pg_temp.login(:parent1_b);
select is(public.can_direct_message(:teacher_ps), false, 'a guardian whose messaging right is withdrawn cannot open a direct message');
select is(public.is_thread_member(:group_ps, :parent1_b), false, 'and is pruned from the parents group');
select ok(public.is_thread_member(:official_ps, :parent1_b), 'but keeps reading the official channel of the class');
select pg_temp.owner();
update public.student_guardians set can_message = true where user_id = :parent1_b;
select ok(public.is_thread_member(:group_ps, :parent1_b) = false, 'the membership is not restored automatically');
select pg_temp.login(:teacher_ps);
select lives_ok(format($$select public.ensure_class_threads(%L)$$, :class_ps), 'the teacher resynchronises the class threads');
select ok(public.is_thread_member(:group_ps, :parent1_b), 'and the guardian is back in the parents group');

-- ── reports and moderation ───────────────────────────────────────────────────
select pg_temp.login(:parent1);
with r as (
  insert into public.reports (school_id, message_id, reporter_id, reason, status)
  values ('f0000000-0000-4000-8000-000000000001', :'msg', :parent1, 'x', 'resolved') returning id
)
select id as report from r \gset
select is((select school_id from public.reports where id = :'report'), :school::uuid, 'a report carries the school of the message');
select is((select status::text from public.reports where id = :'report'), 'open', 'and always starts open');

-- ── events ───────────────────────────────────────────────────────────────────
select pg_temp.login(:teacher_ps);
select throws_ok(
  format($$insert into public.events (school_id, scope, target_ids, title, starts_at, kind, created_by) values (%L, 'class', array[%L::uuid, %L::uuid], 'x', now(), 'meeting', %L)$$, :school, :class_ps, :class_cp, :teacher_ps),
  '42501', null, 'a teacher cannot target a class they do not teach');
select throws_ok(
  format($$insert into public.events (school_id, scope, target_ids, title, starts_at, kind, created_by) values (%L, 'school', '{}', 'x', now(), 'meeting', %L)$$, :school, :teacher_ps),
  '42501', null, 'a teacher cannot publish a school-wide event');
select pg_temp.login(:admin);
select throws_ok(
  format($$update public.events set school_id = %L where id = %L$$, 'f0000000-0000-4000-8000-000000000001', :event_school),
  '42501', null, 'an event cannot be moved to another school');

-- ── read-only guardians and parents ──────────────────────────────────────────
select pg_temp.login(:guardian18);
select throws_ok(
  format($$insert into public.document_signatures (document_id, user_id, student_id) values (%L, %L, %L)$$, '00000000-0000-4000-8000-000000002817', :guardian18, :student18),
  '42501', null, 'a read-only guardian cannot sign a document');
select pg_temp.login(:parent1);
select throws_ok(
  format($$insert into public.absences (school_id, student_id, declared_by, kind, starts_on, ends_on, status, reviewed_by) values (%L, %L, %L, 'absence', current_date, current_date, 'justified', %L)$$, :school, :maya, :parent1, :admin),
  '42501', null, 'a parent cannot declare an absence as already justified');
select throws_ok(
  format($$insert into public.audit_log (school_id, actor_id, action, entity) values (%L, %L, 'student_guardian.block', 'x')$$, :school, :parent1),
  '42501', null, 'audit rows cannot be inserted directly');
select throws_ok(
  format($$select public.log_audit(%L, 'student_guardian.block', 'student_guardians')$$, :school),
  '42501', null, 'a parent cannot log an administrative action');
select lives_ok(format($$select public.log_audit(%L, 'security.mfa_enabled', 'profiles')$$, :school), 'anyone logs their own security events');
select is((select count(*) from public.profile_contacts where user_id = :parent7), 0::bigint, 'phone numbers of other families are not readable');

-- ── staff cannot flip the court restriction ───────────────────────────────────
select pg_temp.login(:staff);
select throws_ok(
  format($$update public.student_guardians set access_blocked = true where student_id = %L and user_id = %L$$, :maya, :parent1_b),
  '42501', null, 'the secretariat cannot set a court restriction');

select * from finish();
rollback;
