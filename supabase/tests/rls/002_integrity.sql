-- pgTAP: integrity rules that must hold regardless of role.
begin;
select plan(7);

select throws_ok(
  $$insert into public.school_years (school_id, label, starts_on, ends_on, is_current)
    values ('00000000-0000-4000-8000-000000000001', '2027-2028', '2027-09-01', '2028-07-06', true)$$,
  '23505',
  null,
  'only one current school year per school'
);

-- tagging a student without signed image rights is refused (family 004: no signature)
select throws_like(
  $$insert into public.class_post_media (post_id, storage_path, tagged_student_ids)
    values ('00000000-0000-4000-8000-000000001537', 'x/y/z.jpg', array['d0000000-0000-4000-8000-000000040001'::uuid])$$,
  '%Droit à l''image non signé%',
  'students without image rights cannot be tagged on photos'
);

select lives_ok(
  $$insert into public.class_post_media (post_id, storage_path, tagged_student_ids)
    values ('00000000-0000-4000-8000-000000001537', 'x/y/z.jpg', array['d0000000-0000-4000-8000-000000010001'::uuid])$$,
  'students with signed image rights can be tagged'
);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'every public table has row level security enabled'
);

-- signing the image-rights document for a child stamps the student record (family 004 had none)
insert into public.document_signatures (document_id, user_id, student_id)
values ('00000000-0000-4000-8000-000000002818', 'c0000000-0000-4000-8000-000000040001', 'd0000000-0000-4000-8000-000000040001');
select isnt(
  (select image_rights_signed_at from public.students where id = 'd0000000-0000-4000-8000-000000040001'),
  null,
  'image-rights signature stamps students.image_rights_signed_at'
);

-- class threads are created once and members kept in sync
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select * from public.ensure_class_threads('00000000-0000-4000-8000-000000000514')$$, 'ensure_class_threads runs for the direction');
select is(
  (select count(*) from public.threads where class_id = '00000000-0000-4000-8000-000000000514' and not archived),
  2::bigint,
  'ensure_class_threads is idempotent (official + group only)'
);

select * from finish();
rollback;
