-- Session 33 — l'espace devoirs : des pages jointes, affichées chez les familles.
--
-- A homework could already carry photos: its composer was the cahier de vie's,
-- with the image-rights attestation and the pupil tags, and no screen of the
-- diary ever displayed what was attached. What a teacher joins to homework is a
-- *document* — the page of the revision book a child left at school, a
-- worksheet exported as PDF — and three columns make it one:
--
--   filename    the name the file had on the teacher's device: written on a
--               PDF's card, and given back when a family downloads it;
--   size_bytes  printed beside a PDF ("240 Ko"), so a family on a phone plan
--               knows what it is about to open;
--   thumb_path  a 480 px rendition written at publication, so that a week of
--               homework with ten pages costs a few hundred kilobytes on a
--               phone instead of ten full-resolution images.
--
-- The upload itself no longer goes through a Server Action: Next caps its body
-- at 1 MB and Vercel at 4.5 MB, and a photo taken with a phone weighs 3 to 5 MB.
-- The browser writes the file straight to the private bucket, under the same
-- policies as before (ADR-0071).

alter table public.class_post_media
  add column if not exists filename text,
  add column if not exists size_bytes bigint,
  add column if not exists thumb_path text;

alter table public.class_post_media drop constraint if exists class_post_media_filename_check;
alter table public.class_post_media add constraint class_post_media_filename_check
  check (filename is null or char_length(filename) between 1 and 200);
alter table public.class_post_media drop constraint if exists class_post_media_size_bytes_check;
alter table public.class_post_media add constraint class_post_media_size_bytes_check
  check (size_bytes is null or size_bytes >= 0);
-- A rendition lives beside its original, in the same folder of the same post:
-- the storage policies, which read the class from the path, then cover both.
alter table public.class_post_media drop constraint if exists class_post_media_thumb_path_check;
alter table public.class_post_media add constraint class_post_media_thumb_path_check
  check (
    thumb_path is null
    or regexp_replace(thumb_path, '/[^/]*$', '') = regexp_replace(storage_path, '/[^/]*$', '')
  );

-- Opening or downloading a page goes through `/api/storage/class-media`, which looks the file
-- up by its path — so that the publication's own policies decide, not the folder alone.
create index if not exists class_post_media_storage_path_idx on public.class_post_media (storage_path);

-- ── « Fait » belongs to the child, not to the parent who ticked it ──────────
-- The tick was « vu », a receipt each parent gave for themselves; it is now « Fait », the
-- state of a child's homework (ADR-0070). Two parents share it: the father must be able to
-- untick what the mother ticked by mistake. Who may tick is unchanged — a guardian of the
-- child who may write in the school, never a read-only guardian, never a blocked access.
drop policy if exists homework_completions_delete on public.homework_completions;
create policy homework_completions_delete on public.homework_completions for delete to authenticated
  using (
    marked_by_user_id = (select auth.uid())
    or public.teaches_student(student_id, (select auth.uid()))
    or (
      student_id in (select public.guardian_student_ids((select auth.uid())))
      and public.can_write_in_school(public.student_school_id(student_id), (select auth.uid()))
    )
  );

-- ── Messages: an upload asks what the message asks ──────────────────────────
-- Membership alone opened the thread's folder to every member — a read-only
-- guardian, a parent whose channel the school has closed — who could then drop
-- files nobody would ever be allowed to send. It cost nothing while the files
-- travelled through the Server Action, which checked first; now that the
-- browser writes them itself, the bucket asks `can_post_in_thread`, the same
-- function as the INSERT on `messages` (ADR-0037, ADR-0060).
drop policy if exists storage_messages_insert on storage.objects;
create policy storage_messages_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'messages'
    and public.can_post_in_thread(public.try_uuid((storage.foldername(name))[2]), (select auth.uid()))
  );
