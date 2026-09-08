-- Private buckets. Files are served through short-lived signed URLs; RLS on storage.objects
-- mirrors the table policies using the path convention documented for each bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  -- {school_id}/{class_id}/{post_id}/{file}
  ('class-media', 'class-media', false, 25 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']),
  -- {school_id}/{document_id}/{file}
  ('documents', 'documents', false, 25 * 1024 * 1024, null),
  -- {school_id}/{announcement_id}/{file}
  ('attachments', 'attachments', false, 25 * 1024 * 1024, null),
  -- {school_id}/{student_id}/{file}
  ('justifications', 'justifications', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- avatars: {user_id}/{file}
create policy storage_avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_profile(public.try_uuid((storage.foldername(name))[1]), (select auth.uid())));
create policy storage_avatars_write on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and public.try_uuid((storage.foldername(name))[1]) = (select auth.uid()))
  with check (bucket_id = 'avatars' and public.try_uuid((storage.foldername(name))[1]) = (select auth.uid()));

-- class-media: {school_id}/{class_id}/{post_id}/{file}
create policy storage_class_media_select on storage.objects for select to authenticated
  using (bucket_id = 'class-media' and public.can_access_class(public.try_uuid((storage.foldername(name))[2]), (select auth.uid())));
create policy storage_class_media_write on storage.objects for all to authenticated
  using (
    bucket_id = 'class-media'
    and (
      public.is_class_teacher(public.try_uuid((storage.foldername(name))[2]), (select auth.uid()))
      or public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'class-media'
    and (
      public.is_class_teacher(public.try_uuid((storage.foldername(name))[2]), (select auth.uid()))
      or public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
    )
  );

-- documents: {school_id}/{document_id}/{file}
create policy storage_documents_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (select 1 from public.documents d where d.id = public.try_uuid((storage.foldername(name))[2]))
  );
create policy storage_documents_write on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid())))
  with check (bucket_id = 'documents' and public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid())));

-- attachments: {school_id}/{announcement_id}/{file}
create policy storage_attachments_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and exists (select 1 from public.announcements a where a.id = public.try_uuid((storage.foldername(name))[2]))
  );
create policy storage_attachments_write on storage.objects for all to authenticated
  using (bucket_id = 'attachments' and public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid())))
  with check (bucket_id = 'attachments' and public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid())));

-- justifications: {school_id}/{student_id}/{file}
create policy storage_justifications_select on storage.objects for select to authenticated
  using (bucket_id = 'justifications' and public.can_access_student(public.try_uuid((storage.foldername(name))[2]), (select auth.uid())));
create policy storage_justifications_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'justifications'
    and (
      public.try_uuid((storage.foldername(name))[2]) in (select public.guardian_student_ids((select auth.uid())))
      or public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
    )
  );
create policy storage_justifications_delete on storage.objects for delete to authenticated
  using (bucket_id = 'justifications' and public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid())));
