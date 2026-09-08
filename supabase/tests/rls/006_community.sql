-- pgTAP: community (session 12) — opt-in directory, birthdays, classifieds moderation enforced in
-- the database, parent-teacher appointments (one per family), forms and their notifications.
begin;
select plan(24);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end $$;

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_ms '''00000000-0000-4000-8000-000000000515'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set teacher_ms '''b0000000-0000-4000-8000-000000000003'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set parent1_b '''c0000000-0000-4000-8000-000000010002'''
\set parent3_a '''c0000000-0000-4000-8000-000000030001'''
\set guardian18 '''c0000000-0000-4000-8000-000000180003'''
\set maya '''d0000000-0000-4000-8000-000000010001'''
\set noam '''d0000000-0000-4000-8000-000000010002'''
\set slot_free '''00000000-0000-4000-8000-000000003587'''
\set slot_free2 '''00000000-0000-4000-8000-000000003588'''
\set slot_booked '''00000000-0000-4000-8000-000000003586'''
\set form_rentree '''00000000-0000-4000-8000-000000003329'''
\set post '''00000000-0000-4000-8000-000000009601'''

-- directory --------------------------------------------------------------------------------
select pg_temp.login(:parent1);
select lives_ok(
  format($$insert into public.directory_optins (user_id, school_id, show_phone, show_email, show_children_names, show_address, show_birthday)
          values (%L, %L, true, false, true, false, true)
          on conflict (user_id, school_id) do update set show_phone = true, show_email = false, show_children_names = true, show_address = false, show_birthday = true$$, :parent1, :school),
  'a parent chooses what to share'
);
select ok(
  exists (select 1 from public.class_directory(:class_ps) d where d.user_id = :parent1 and d.phone is not null and d.email is null and 'Maya' = any (d.children)),
  'the class directory exposes only the shared fields'
);
select is((select count(*) from public.class_directory(:class_ms)), 0::bigint, 'families cannot read the directory of another class');
select ok((select count(*) from public.class_birthdays(:class_ps)) > 0, 'opted-in birthdays are listed for the class');

-- classifieds: moderation enforced by the database ------------------------------------------
select lives_ok(
  format($$insert into public.community_posts (id, school_id, author_id, category, title, body, status)
          values (%L, %L, %L, 'carpool', 'Covoiturage Neuilly', 'Départ 8 h 10.', 'published')$$, :post, :school, :parent1),
  'a parent posts a classified'
);
select is((select status from public.community_posts where id = :post), 'pending'::public.community_status, 'non-staff posts always start pending');
select throws_ok(
  format($$update public.community_posts set status = 'published' where id = %L$$, :post),
  '42501', null, 'authors cannot publish their own posts'
);
select pg_temp.login(:parent3_a);
select is((select count(*) from public.community_posts where id = :post), 0::bigint, 'pending posts are invisible to other families');
select pg_temp.login(:admin);
select is((select count(*) from public.notifications where kind = 'community.pending' and payload->>'post_id' = :post), 1::bigint, 'staff is notified of pending posts');
select lives_ok(
  format($$update public.community_posts set status = 'published', moderated_by = %L, moderated_at = now() where id = %L$$, :admin, :post),
  'staff approves the post'
);
select pg_temp.login(:parent3_a);
select is((select count(*) from public.community_posts where id = :post), 1::bigint, 'published posts are visible to the school');
select ok(exists (select 1 from public.classified_contact(:post) c where c.phone is not null and c.email is null), 'contact details follow the directory opt-in');
select pg_temp.login(:parent1);
select is((select count(*) from public.notifications where kind = 'community.moderated' and payload->>'post_id' = :post), 1::bigint, 'the author is told about the decision');
select lives_ok(format($$update public.community_posts set status = 'archived' where id = %L$$, :post), 'authors can withdraw their post');

-- appointments -----------------------------------------------------------------------------
select pg_temp.login(:parent3_a);
select throws_ok(format($$select public.book_appointment(%L, %L)$$, :slot_free, :maya), '42501', null, 'only guardians of the child can book for them');
select pg_temp.login(:parent1);
select throws_ok(format($$select public.book_appointment(%L, %L)$$, :slot_free, :maya), '23514', null, 'one appointment per family and class (a slot is already booked)');
select lives_ok(format($$select public.cancel_appointment(%L)$$, :slot_booked), 'the family cancels its appointment');
select lives_ok(format($$select public.book_appointment(%L, %L)$$, :slot_free, :maya), 'the family books another slot');
select pg_temp.login(:parent1_b);
select throws_ok(format($$select public.book_appointment(%L, %L)$$, :slot_free2, :maya), '23514', null, 'the other parent of the family cannot book a second slot');
select pg_temp.login(:teacher_ps);
select is((select count(*) from public.notifications where kind = 'appointment.booked' and payload->>'slot_id' = :slot_free), 1::bigint, 'the teacher is notified of bookings');
select ok(exists (select 1 from public.class_appointments(:class_ps) a where a.id = :slot_free and a.parent_name is not null), 'the teacher sees who booked');
select pg_temp.login(:parent3_a);
select is((select count(*) from public.class_appointments(:class_ps)), 0::bigint, 'families never see other families'' bookings');

-- forms ------------------------------------------------------------------------------------
select pg_temp.login(:parent1_b);
select lives_ok(
  format($$insert into public.form_responses (form_id, user_id, student_id, answers) values (%L, %L, %L, '{"pickup": "Papi", "emergency": "+33600000001", "lunch": "Cantine", "consent": true}')$$, :form_rentree, :parent1_b, :noam),
  'a parent answers the back-to-school form for a child'
);
select throws_ok(
  format($$insert into public.form_responses (form_id, user_id, student_id, answers) values (%L, %L, %L, '{}')$$, :form_rentree, :parent1_b, 'd0000000-0000-4000-8000-000000030001'),
  '42501', null, 'a parent cannot answer for another family''s child'
);

select * from finish();
rollback;
