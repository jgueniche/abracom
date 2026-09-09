-- pgTAP: role matrix from brief §5 against the demo seed. Run by scripts/db/test-local.sh
-- (or `supabase test db` once the Supabase stack is available).
begin;
select plan(75);

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

-- fixtures (ids: see the header of supabase/seed/seed.sql — decimal, zero-padded) ---
\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_ms '''00000000-0000-4000-8000-000000000515'''
\set class_cp '''00000000-0000-4000-8000-000000000517'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set superadmin '''a0000000-0000-4000-8000-000000000003'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set teacher_ms '''b0000000-0000-4000-8000-000000000003'''
\set teacher_en '''b0000000-0000-4000-8000-000000000011'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set parent1_child_ps '''d0000000-0000-4000-8000-000000010001'''
\set parent1_child_cp '''d0000000-0000-4000-8000-000000010002'''
\set parent3_a '''c0000000-0000-4000-8000-000000030001'''
\set parent3_b '''c0000000-0000-4000-8000-000000030002'''
\set guardian18 '''c0000000-0000-4000-8000-000000180003'''
\set student18 '''d0000000-0000-4000-8000-000000180001'''
\set blocked44 '''c0000000-0000-4000-8000-000000440002'''
\set invited51 '''c0000000-0000-4000-8000-000000510002'''
\set student44 '''d0000000-0000-4000-8000-000000440001'''
\set ann_school '''00000000-0000-4000-8000-000000001281'''
\set ann_class_ps '''00000000-0000-4000-8000-000000001284'''
\set ann_class_ce1 '''00000000-0000-4000-8000-000000001285'''
\set ann_custom_parent1 '''00000000-0000-4000-8000-000000001289'''
\set group_ps '''00000000-0000-4000-8000-000000003090'''
\set group_ms '''00000000-0000-4000-8000-000000003091'''

-- anon ------------------------------------------------------------------------
select pg_temp.logout();
select is((select count(*) from public.schools), 0::bigint, 'anon sees no school');
select is((select count(*) from public.students), 0::bigint, 'anon sees no student');

-- helper functions are staff-only
select pg_temp.login('c0000000-0000-4000-8000-000000010001'::uuid);
select is((select count(*) from public.announcement_recipients(:ann_school)), 0::bigint, 'parents cannot list announcement recipients');
select throws_ok(format('select public.remind_announcement(%L)', :ann_school), '42501', null, 'parents cannot send reminders');

-- parent-1 (family 001: PS Tournesols + CP Oliviers) ---------------------------
select pg_temp.login(:parent1);
select is((select count(*) from public.schools), 1::bigint, 'parent sees their school');
select is((select count(*) from public.students), 2::bigint, 'parent sees exactly their two children');
select is((select count(*) from public.classes), 6::bigint, 'parent sees the class list of the school');
select is(
  (select count(distinct class_id) from public.class_posts),
  2::bigint,
  'parent sees posts of their two classes only'
);
select is(
  (select count(*) from public.class_posts where visibility = 'staff'),
  0::bigint,
  'parent never sees staff-only posts'
);
select is(
  (select count(*) from public.class_posts where published_at is null),
  0::bigint,
  'parent never sees drafts'
);
select ok(exists (select 1 from public.announcements where id = :ann_school), 'parent sees school-wide announcement');
select ok(exists (select 1 from public.announcements where id = :ann_class_ps), 'parent sees announcement targeted at their class');
select ok(not exists (select 1 from public.announcements where id = :ann_class_ce1), 'parent does not see announcement of another class');
select ok(exists (select 1 from public.announcements where id = :ann_custom_parent1), 'parent sees custom announcement addressed to them');
select lives_ok(
  format('insert into public.announcement_reads (announcement_id, user_id, acked_at) values (%L, %L, now())', :ann_class_ps, :parent1),
  'parent can acknowledge an announcement'
);
select throws_ok(
  format('insert into public.announcements (school_id, author_id, title) values (%L, %L, ''Test'')', :school, :parent1),
  '42501',
  null,
  'parent cannot publish an official announcement'
);
select ok(
  (select count(*) from public.assessments where student_id = :parent1_child_ps) > 0,
  'parent sees published assessments of their child'
);
select is(
  (select count(*) from public.assessments where student_id <> :parent1_child_ps and student_id <> :parent1_child_cp),
  0::bigint,
  'parent sees no assessment of other children'
);
select is((select count(*) from public.student_private_notes), 0::bigint, 'parent cannot see admin-only notes');
select is(
  (select count(*) from public.individual_notes where student_id = :parent1_child_ps),
  1::bigint,
  'parent sees the parent-visible individual note but not the staff one'
);
select ok(exists (select 1 from public.profiles where id = :teacher_ps), 'parent sees the profile of their child''s teacher');
select ok(not exists (select 1 from public.profiles where id = :parent3_a), 'parent does not see a parent of another class without opt-in');
select is((select count(*) from public.memberships), 1::bigint, 'parent sees only their own membership');
select ok(exists (select 1 from public.threads where id = :group_ps), 'parent is in the parents group of their class');
select ok(not exists (select 1 from public.threads where id = :group_ms), 'parent cannot see the group of another class');
select lives_ok(
  format('insert into public.messages (thread_id, author_id, body) values (%L, %L, ''Bonjour'')', :group_ps, :parent1),
  'parent can post in their class group'
);
select throws_ok(
  format('insert into public.messages (thread_id, author_id, body) values (%L, %L, ''Bonjour'')', :group_ms, :parent1),
  '42501',
  null,
  'parent cannot post in another class group'
);
select throws_ok(
  format('insert into public.messages (thread_id, author_id, body) values (%L, %L, ''Coucou'')', :group_ps, :teacher_ps),
  '42501',
  null,
  'parent cannot impersonate another author'
);

-- class space: homework "vu", absences, individual notes ---------------------------
\set homework_ps '''00000000-0000-4000-8000-000000001550'''
select lives_ok(
  format('insert into public.homework_completions (post_id, student_id, marked_by_user_id) values (%L, %L, %L)', :homework_ps, :parent1_child_ps, :parent1),
  'parent marks homework as seen for their child'
);
select throws_ok(
  format('insert into public.homework_completions (post_id, student_id, marked_by_user_id) values (%L, %L, %L)', :homework_ps, :student18, :parent1),
  '42501', null,
  'parent cannot mark homework for another child'
);
select lives_ok(
  format('insert into public.absences (school_id, student_id, declared_by, kind, starts_on, ends_on, reason) values (%L, %L, %L, ''absence'', current_date, current_date, ''Fièvre'')', :school, :parent1_child_ps, :parent1),
  'parent declares an absence for their child'
);
select throws_ok(
  format('insert into public.individual_notes (school_id, student_id, author_id, body_md) values (%L, %L, %L, ''x'')', :school, :parent1_child_ps, :parent1),
  '42501', null,
  'parent cannot write individual notes'
);
select throws_ok(
  format('insert into public.class_posts (school_id, class_id, author_id, type, title, published_at) values (%L, %L, %L, ''info'', ''Test'', now())', :school, :class_ps, :parent1),
  '42501', null,
  'parent cannot publish in the class feed'
);

-- messaging helpers ----------------------------------------------------------------
select ok(public.can_direct_message(:teacher_ps), 'parent may message the teacher of their child');
select ok(not public.can_direct_message(:parent3_a), 'parent may not message another parent');
select ok(public.can_direct_message(:admin), 'parent may message the direction');
select ok(not public.can_direct_message(:teacher_ms), 'parent may not message a teacher of another class');
select lives_ok(format('select public.open_dm(%L)', :teacher_ps), 'parent opens a DM with the teacher');
select is(
  (select count(*) from public.threads t join public.thread_members a on a.thread_id = t.id and a.user_id = :parent1
     join public.thread_members b on b.thread_id = t.id and b.user_id = :teacher_ps where t.kind = 'dm'),
  1::bigint,
  'open_dm reuses the existing DM instead of creating a duplicate'
);
select ok((select count(*) from public.my_threads()) >= 3, 'my_threads lists the parent conversations');
select throws_ok(format('select public.open_dm(%L)', :parent3_a), '42501', null, 'open_dm refuses parent to parent');

-- separated family (003): parents do not see each other's profile ---------------
select pg_temp.login(:parent3_b);
select ok(not exists (select 1 from public.profile_contacts where user_id = :parent3_a), 'separated parent does not see the other parent''s contact details');
select ok(exists (select 1 from public.profiles where id = :parent3_a), 'the name of a fellow member of the class group stays visible');
select is((select count(*) from public.student_guardians), 1::bigint, 'separated parent sees only their own guardian row');

-- read-only guardian (family 018, child in MS Bleuets which has assessments) ------
select pg_temp.login(:guardian18);
select ok(exists (select 1 from public.students where id = :student18), 'guardian sees the child');
select ok((select count(*) from public.class_posts) > 0, 'guardian sees the class feed');
select is((select count(*) from public.assessments), 0::bigint, 'guardian never sees assessments');
select throws_ok(
  format('insert into public.absences (school_id, student_id, declared_by, kind, starts_on, ends_on) values (%L, %L, %L, ''late'', current_date, current_date)', :school, :student18, :guardian18),
  '42501', null,
  'read-only guardian cannot declare absences'
);
select throws_ok(
  format('insert into public.messages (thread_id, author_id, body) values (%L, %L, ''Bonjour'')', :group_ms, :guardian18),
  '42501',
  null,
  'guardian cannot post messages'
);

-- blocked guardian (family 044, court restriction) --------------------------------
select pg_temp.login(:blocked44);
select is((select count(*) from public.students), 0::bigint, 'blocked guardian sees no student');
select is((select count(*) from public.student_guardians), 0::bigint, 'blocked guardian does not even see the relationship row');

-- invited parent (family 051, parent 02): activates only their own membership ---------
select pg_temp.login(:invited51);
select is((select count(*) from public.students), 0::bigint, 'an invited (not yet active) parent sees nothing');
select is(public.activate_my_memberships(), 1, 'onboarding activates the invited membership');
select is(
  (select status from public.memberships where user_id = :invited51),
  'active'::public.membership_status,
  'the membership is now active'
);

-- teacher PS Tournesols ------------------------------------------------------------
select pg_temp.login(:teacher_ps);
select is(
  (select count(*) from public.students),
  (select count(*) from public.enrollments where class_id = :class_ps),
  'main teacher sees the students of their class only'
);
select lives_ok(
  format('insert into public.class_posts (school_id, class_id, author_id, type, title, published_at) values (%L, %L, %L, ''info'', ''Test'', now())', :school, :class_ps, :teacher_ps),
  'teacher can post in their class'
);
select throws_ok(
  format('insert into public.class_posts (school_id, class_id, author_id, type, title, published_at) values (%L, %L, %L, ''info'', ''Test'', now())', :school, :class_ms, :teacher_ps),
  '42501',
  null,
  'teacher cannot post in another class'
);
select is((select count(*) from public.student_private_notes), 0::bigint, 'teacher cannot see admin-only notes');
select lives_ok(
  format('insert into public.individual_notes (school_id, student_id, author_id, body_md, kind) values (%L, %L, %L, ''Très bien.'', ''praise'')', :school, :parent1_child_ps, :teacher_ps),
  'teacher writes an individual note to a student of their class'
);
select ok((select count(*) from public.absences where student_id = :parent1_child_ps) > 0, 'teacher sees the absences of their students');
select ok(exists (select 1 from public.profiles where id = :parent1), 'teacher sees the guardians of their students');
select is(
  (select count(*) from public.student_guardians where student_id = :student44),
  2::bigint,
  'teacher sees the guardians (including the restricted one) of their own students'
);

-- teacher MS Bleuets: no access to PS Tournesols families ------------------------
select pg_temp.login(:teacher_ms);
select is(
  (select count(*) from public.student_guardians where student_id = :student44),
  0::bigint,
  'teacher of another class does not see those relationships'
);

-- English specialist: every class -------------------------------------------------
select pg_temp.login(:teacher_en);
select is((select count(*) from public.students), (select count(*) from public.enrollments), 'specialist sees every enrolled student');

-- staff (secrétariat) ---------------------------------------------------------------
select pg_temp.login(:staff);
select is((select count(*) from public.students), (select count(*) from public.enrollments), 'staff sees every student');
select is((select count(*) from public.assessments), 0::bigint, 'staff has no access to assessments');
select throws_ok(
  format('insert into public.memberships (user_id, school_id, role, status) values (%L, %L, ''teacher'', ''active'')', :parent1, :school),
  '42501',
  null,
  'staff cannot grant roles'
);

-- school admin ----------------------------------------------------------------------
select pg_temp.login(:admin);
select lives_ok(
  format('insert into public.student_private_notes (student_id, author_id, body) values (%L, %L, ''Note confidentielle'')', :student18, :admin),
  'admin can write admin-only notes'
);
select ok((select count(*) from public.assessments) > 0, 'admin sees assessments');
select ok((select count(*) from public.audit_log) > 0, 'admin reads the audit log');

select ok((select count(*) from public.announcement_recipients(:ann_school)) > 100, 'admin lists the recipients of a school-wide announcement');
select is(
  (select count(*) from public.announcement_recipients(:ann_class_ps)),
  (select count(distinct sg.user_id) from public.enrollments e
     join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
     join public.memberships m on m.user_id = sg.user_id and m.status = 'active' and m.role in ('parent', 'guardian')
     where e.class_id = :class_ps)
    + (select count(*) from public.class_teachers ct where ct.class_id = :class_ps),
  'class announcement recipients = active guardians of the class + its teachers'
);
select ok(public.remind_announcement(:ann_class_ps) > 0, 'reminder creates in-app notifications for non-acknowledgers');
select ok(
  (select count(*) from public.document_missing_signatures('00000000-0000-4000-8000-000000002818')) > 0,
  'missing image-rights signatures are listed per student'
);

-- super admin ----------------------------------------------------------------------
select pg_temp.login(:superadmin);
select is((select count(*) from public.schools), 1::bigint, 'super admin sees every school');

select * from finish();
rollback;
