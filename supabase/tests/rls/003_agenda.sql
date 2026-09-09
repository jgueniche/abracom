-- pgTAP: agenda (session 9) — visibility, RSVP with capacity and waiting list, volunteer slots,
-- private ICS feeds, notifications and reminders.
begin;
select plan(42);

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

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_ms '''00000000-0000-4000-8000-000000000515'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set parent3_a '''c0000000-0000-4000-8000-000000030001'''
\set guardian18 '''c0000000-0000-4000-8000-000000180003'''
\set ev_no_rsvp '''00000000-0000-4000-8000-000000002049'''
\set ev_class_ce1 '''00000000-0000-4000-8000-000000002055'''
\set slot_fruits '''00000000-0000-4000-8000-000000002306'''
\set ev_test '''00000000-0000-4000-8000-000000009001'''
\set ev_closed '''00000000-0000-4000-8000-000000009002'''
\set ev_soon '''00000000-0000-4000-8000-000000009003'''

-- visibility ---------------------------------------------------------------------------
select pg_temp.login(:parent1);
select is((select count(*) from public.events), 13::bigint, 'parent sees school, level and class events of their children');
select is((select count(*) from public.events where id = :ev_class_ce1), 0::bigint, 'parent does not see events of other classes');
select is((select count(*) from public.events where kind = 'holiday'), 7::bigint, 'school holidays are visible to everyone');

select pg_temp.login(:guardian18);
select ok((select count(*) from public.events) > 0, 'read-only guardians see the agenda');

-- teachers: class events for their own classes only --------------------------------------
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into public.events (school_id, scope, target_ids, title, starts_at, kind, created_by)
          values (%L, 'class', array[%L::uuid], 'Sortie test', now() + interval '3 days', 'outing', %L)$$, :school, :class_ps, :teacher_ps),
  'a teacher creates an event for their own class'
);
select throws_ok(
  format($$insert into public.events (school_id, scope, target_ids, title, starts_at, kind, created_by)
          values (%L, 'class', array[%L::uuid], 'Sortie test', now() + interval '3 days', 'outing', %L)$$, :school, :class_ms, :teacher_ps),
  '42501', null, 'a teacher cannot create an event for another class'
);
select throws_ok(
  format($$insert into public.events (school_id, scope, target_ids, title, starts_at, kind, created_by)
          values (%L, 'school', '{}', 'Fête test', now() + interval '3 days', 'celebration', %L)$$, :school, :teacher_ps),
  '42501', null, 'a teacher cannot create a school-wide event'
);

-- RSVP: capacity, waiting list, deadline ---------------------------------------------------
select pg_temp.login(:admin);
select lives_ok(
  format($$insert into public.events (id, school_id, scope, target_ids, title, starts_at, kind, requires_rsvp, capacity, rsvp_deadline, created_by)
          values (%L, %L, 'school', '{}', 'Réunion test', now() + interval '10 days', 'meeting', true, 2, now() + interval '5 days', %L)$$, :ev_test, :school, :admin),
  'admin creates an event with two seats'
);
select lives_ok(
  format($$insert into public.events (id, school_id, scope, target_ids, title, starts_at, kind, requires_rsvp, rsvp_deadline, created_by)
          values (%L, %L, 'school', '{}', 'Réunion close', now() + interval '10 days', 'meeting', true, now() - interval '1 hour', %L)$$, :ev_closed, :school, :admin),
  'admin creates an event whose RSVP deadline has passed'
);
select ok(public.notify_event(:ev_test) > 100, 'publishing an event notifies every recipient');
select is(public.notify_event(:ev_test), 0, 'notifications are not sent twice');
select ok((select count(*) from public.event_recipients(:ev_test)) > 100, 'admin lists the recipients of a school-wide event');

select pg_temp.login(:parent1);
select is(public.rsvp_event(:ev_test, 'yes', 1), false, 'the first answer is confirmed (two seats of two)');
select is((select yes_seats from public.event_counts(:ev_test)), 2, 'attendance counts are visible to parents');
select is((select count(*) from public.event_recipients(:ev_test)), 0::bigint, 'parents cannot list recipients');
select throws_ok(format('select public.notify_event(%L)', :ev_test), '42501', null, 'parents cannot send event notifications');
select throws_ok(
  format($$insert into public.event_rsvps (event_id, user_id, status) values (%L, %L, 'yes')$$, :ev_test, :parent1),
  '42501', null, 'answers cannot bypass rsvp_event()'
);
select throws_ok(format($$select public.rsvp_event(%L, 'yes')$$, :ev_closed), '23514', null, 'answers after the deadline are refused');
select throws_ok(format($$select public.rsvp_event(%L, 'yes')$$, :ev_no_rsvp), '23514', null, 'events without RSVP refuse answers');

select pg_temp.login(:parent3_a);
select is(public.rsvp_event(:ev_test, 'yes', 0), true, 'the next answer goes to the waiting list');
select is(
  (select waitlisted from public.event_rsvps where event_id = :ev_test and user_id = :parent3_a),
  true, 'the waiting-list flag is readable by its owner'
);

select pg_temp.login(:parent1);
select is(public.rsvp_event(:ev_test, 'no', 0), false, 'changing the answer frees the seats');

select pg_temp.login(:parent3_a);
select is(
  (select waitlisted from public.event_rsvps where event_id = :ev_test and user_id = :parent3_a),
  false, 'the waiting list is promoted in order'
);
select is(
  (select count(*) from public.notifications where kind = 'event.confirmed' and payload->>'event_id' = :ev_test),
  1::bigint, 'promoted attendees are notified'
);

select pg_temp.login(:guardian18);
select throws_ok(format($$select public.rsvp_event(%L, 'yes')$$, :ev_test), '42501', null, 'read-only guardians cannot answer');
select throws_ok(
  format($$insert into public.event_slot_signups (slot_id, user_id) values (%L, %L)$$, :slot_fruits, :guardian18),
  '42501', null, 'read-only guardians cannot volunteer'
);

-- volunteer slots ------------------------------------------------------------------------
select pg_temp.login(:parent1);
select lives_ok(
  format($$insert into public.event_slot_signups (slot_id, user_id) values (%L, %L)$$, :slot_fruits, :parent1),
  'a parent volunteers for an open slot'
);
select is((select count(*) from public.event_slot_signups where slot_id = :slot_fruits), 2::bigint, 'volunteers of a slot are visible');
select pg_temp.login(:teacher_ps);
select throws_ok(
  format($$insert into public.event_slot_signups (slot_id, user_id) values (%L, %L)$$, :slot_fruits, :teacher_ps),
  '23514', null, 'a full slot refuses new volunteers'
);

-- private ICS feed -----------------------------------------------------------------------
select pg_temp.login(:parent1);
select is(length((public.my_calendar_feed()).token), 48, 'a private feed token is created on demand');
select token as feed_token from public.calendar_feeds where user_id = :parent1 \gset
select pg_temp.logout();
select throws_ok('select public.my_calendar_feed()', '42501', null, 'anonymous users cannot create feeds');
select is((select school_name from public.calendar_feed(:'feed_token')), 'École Abravanel Neuilly', 'the feed token resolves the school');
select ok((select count(*) from public.calendar_feed_events(:'feed_token')) >= 13, 'the feed lists the events visible to its owner');
select is((select count(*) from public.calendar_feed_events(:'feed_token') where id = :ev_class_ce1), 0::bigint, 'the feed hides other classes'' events');
select is((select count(*) from public.calendar_feed_events('not-a-token')), 0::bigint, 'an unknown token yields nothing');
select pg_temp.login(:parent1);
select isnt((public.rotate_calendar_feed()).token, :'feed_token', 'rotating the feed changes the token');
select is((select count(*) from public.calendar_feed_events(:'feed_token')), 0::bigint, 'the old token is revoked');

-- reminders (service role) ---------------------------------------------------------------
select pg_temp.login(:admin);
select lives_ok(
  format($$insert into public.events (id, school_id, scope, target_ids, title, starts_at, kind, requires_rsvp, created_by)
          values (%L, %L, 'school', '{}', 'Rappel test', now() + interval '7 days', 'meeting', true, %L)$$, :ev_soon, :school, :admin),
  'admin creates an event in seven days'
);
select throws_ok('select public.queue_event_reminders()', '42501', null, 'reminders are queued by the service role only');
select set_config('role', 'service_role', true);
select ok(public.queue_event_reminders() > 100, 'J-7 reminders reach everyone who has not answered');
select is(public.queue_event_reminders(), 0, 'reminders are idempotent');
select is(
  (select count(*) from public.notifications where kind = 'event.reminder' and payload->>'event_id' = :ev_soon and (payload->>'days')::int = 7),
  (select count(*) from public.event_recipients(:ev_soon)),
  'one J-7 reminder per recipient'
);

select * from finish();
rollback;
