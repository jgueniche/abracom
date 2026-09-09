-- pgTAP: notifications (session 10) — fan-out triggers, preferences, planned deliveries,
-- dispatch / digest functions reserved to the service role.
begin;
select plan(36);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set group_ps '''00000000-0000-4000-8000-000000003090'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set child_ps '''d0000000-0000-4000-8000-000000010001'''
\set ann_a '''00000000-0000-4000-8000-000000009101'''
\set ann_b '''00000000-0000-4000-8000-000000009102'''
\set post_parents '''00000000-0000-4000-8000-000000009201'''
\set post_staff '''00000000-0000-4000-8000-000000009202'''
\set absence '''00000000-0000-4000-8000-000000009301'''
\set message '''00000000-0000-4000-8000-000000009401'''
\set report '''00000000-0000-4000-8000-000000009402'''
\set message2 '''00000000-0000-4000-8000-000000009403'''
\set note '''00000000-0000-4000-8000-000000009501'''

-- announcements: fan-out on publication, planned deliveries -----------------------------
select pg_temp.login(:admin);
select lives_ok(
  format($$insert into public.announcements (id, school_id, author_id, audience, target_ids, title, body_md, published_at)
          values (%L, %L, %L, 'school', '{}', 'Annonce test', 'Corps', now())$$, :ann_a, :school, :admin),
  'admin publishes a school-wide announcement'
);
select ok(public.notify_due_content() > 100, 'publishing notifies every recipient of the school');
select is(public.notify_due_content(), 0, 'published content is notified once');

select pg_temp.login(:parent1);
select is(
  (select count(*) from public.notifications where kind = 'announcement.new' and payload->>'announcement_id' = :ann_a),
  1::bigint, 'the parent receives the announcement notification'
);
select is(
  (select count(*) from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
   where n.payload->>'announcement_id' = :ann_a and d.channel = 'email'),
  1::bigint, 'an e-mail delivery is planned by default'
);
select is(
  (select count(*) from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
   where n.payload->>'announcement_id' = :ann_a and d.channel = 'push'),
  0::bigint, 'no push delivery without a subscription'
);
select throws_ok('select public.notify_due_content()', '42501', null, 'parents cannot trigger the fan-out');
select lives_ok(
  format($$insert into public.push_subscriptions (user_id, endpoint, keys) values (%L, 'https://push.example/parent-1', '{"p256dh": "x", "auth": "y"}')$$, :parent1),
  'the parent registers a push subscription'
);
select lives_ok(
  format($$insert into public.notification_preferences (user_id, kind, push, email, digest) values (%L, 'announcement', true, false, true)$$, :parent1),
  'the parent turns announcement e-mails off'
);

select pg_temp.login(:admin);
select lives_ok(
  format($$insert into public.announcements (id, school_id, author_id, audience, target_ids, title, body_md, published_at)
          values (%L, %L, %L, 'school', '{}', 'Annonce test 2', 'Corps', now())$$, :ann_b, :school, :admin),
  'admin publishes a second announcement'
);
select ok(public.notify_due_content() > 0, 'the second announcement is fanned out');

select pg_temp.login(:parent1);
select is(
  (select count(*) from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
   where n.payload->>'announcement_id' = :ann_b and d.channel = 'push'),
  1::bigint, 'a push delivery is planned once subscribed'
);
select is(
  (select count(*) from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
   where n.payload->>'announcement_id' = :ann_b and d.channel = 'email'),
  0::bigint, 'the e-mail preference is honoured'
);

-- class posts ---------------------------------------------------------------------------
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, published_at, visibility)
          values (%L, %L, %L, %L, 'homework', 'Poésie à apprendre', 'Strophe 1', now(), 'parents')$$, :post_parents, :school, :class_ps, :teacher_ps),
  'teacher publishes homework'
);
select lives_ok(
  format($$insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, published_at, visibility)
          values (%L, %L, %L, %L, 'info', 'Note interne', 'Équipe', now(), 'staff')$$, :post_staff, :school, :class_ps, :teacher_ps),
  'teacher publishes a staff-only note'
);
select ok(public.notify_due_content() > 0, 'teachers can fan out their own publications');

select pg_temp.login(:parent1);
select is(
  (select count(*) from public.notifications where kind = 'class_post.new' and payload->>'post_id' = :post_parents),
  1::bigint, 'families of the class are notified of homework'
);
select is(
  (select count(*) from public.notifications where kind = 'class_post.new' and payload->>'post_id' = :post_staff),
  0::bigint, 'staff-only posts stay silent'
);

-- individual notes ----------------------------------------------------------------------
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into public.individual_notes (id, school_id, student_id, author_id, body_md, visibility, kind)
          values (%L, %L, %L, %L, 'Très belle journée !', 'parents', 'praise')$$, :note, :school, :child_ps, :teacher_ps),
  'teacher writes an individual note'
);
select pg_temp.login(:parent1);
select is((select count(*) from public.notifications where kind = 'note.new' and payload->>'note_id' = :note), 1::bigint, 'guardians get individual notes');

-- messages: members, mute, never e-mailed ----------------------------------------------
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into public.messages (id, thread_id, author_id, body) values (%L, %L, %L, 'Bonjour à tous')$$, :message, :group_ps, :teacher_ps),
  'teacher posts in the class group'
);
select is((select count(*) from public.notifications where kind = 'message.new' and payload->>'message_id' = :message), 0::bigint, 'authors are not notified of their own messages');

select pg_temp.login(:parent1);
select is(
  (select count(*) from public.notifications where kind = 'message.new' and payload->>'message_id' = :message),
  1::bigint, 'members are notified of new messages'
);
select is(
  (select count(*) from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
   where n.kind = 'message.new' and d.channel = 'email'),
  0::bigint, 'messages are never e-mailed one by one'
);
select lives_ok(
  format($$update public.thread_members set muted = true where thread_id = %L and user_id = %L$$, :group_ps, :parent1),
  'the parent mutes the group'
);
select pg_temp.login(:teacher_ps);
insert into public.messages (id, thread_id, author_id, body) values (:message2, :group_ps, :teacher_ps, 'Deuxième message');
select pg_temp.login(:parent1);
select is(
  (select count(*) from public.notifications where kind = 'message.new' and payload->>'message_id' = :message2),
  0::bigint, 'muted threads stay silent'
);

-- absences and reports ------------------------------------------------------------------
select lives_ok(
  format($$insert into public.absences (id, school_id, student_id, declared_by, kind, status, starts_on, ends_on)
          values (%L, %L, %L, %L, 'absence', 'declared', current_date + 1, current_date + 1)$$, :absence, :school, :child_ps, :parent1),
  'the parent declares an absence'
);
select lives_ok(
  format($$insert into public.reports (id, school_id, message_id, reporter_id, reason) values (%L, %L, %L, %L, 'Test')$$, :report, :school, :message, :parent1),
  'the parent reports a message'
);
select pg_temp.login(:admin);
select is((select count(*) from public.notifications where kind = 'absence.new' and payload->>'absence_id' = :absence), 1::bigint, 'staff learns about declared absences');
select is((select count(*) from public.notifications where kind = 'report.new' and payload->>'report_id' = :report), 1::bigint, 'staff learns about reports');
update public.absences set status = 'justified', reviewed_by = :admin, reviewed_at = now() where id = :absence;
select pg_temp.login(:parent1);
select is((select count(*) from public.notifications where kind = 'absence.reviewed' and payload->>'absence_id' = :absence), 1::bigint, 'parents learn the outcome of an absence');

-- job functions: service role only ------------------------------------------------------
select throws_ok('select * from public.claim_notification_deliveries(10)', '42501', null, 'parents cannot claim deliveries');
select pg_temp.logout();
select throws_ok('select * from public.digest_candidates(now())', '42501', null, 'anonymous users cannot read digests');
select pg_temp.service();
select ok((select count(*) from public.claim_notification_deliveries(500) c where c.email is not null) > 0, 'the service role claims due deliveries with recipient e-mails');
select ok((select count(*) from public.digest_candidates(now() - interval '1 day') where user_id = :parent1) > 0, 'the digest lists unread notifications');
update public.notifications set digested_at = now() where user_id = :parent1;
select is((select count(*) from public.digest_candidates(now() - interval '1 day') where user_id = :parent1), 0::bigint, 'digested notifications are not listed again');

select * from finish();
rollback;
