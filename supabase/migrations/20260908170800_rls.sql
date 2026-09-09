-- Row Level Security for every table (brief §5 matrix). Helpers from 20260908170300 are
-- SECURITY DEFINER so policies never recurse into RLS-protected tables.
-- `anon` gets no policy anywhere: only authenticated users see rows.

-- ── extra helpers ────────────────────────────────────────────────────────────
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end
$$;

-- Does the user match an audience (school / level / class / custom user list)?
create or replace function public.matches_audience(school uuid, audience public.audience_kind, targets uuid[], uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select case audience
    when 'school' then public.is_school_member(school, uid)
    when 'level' then exists (
      select 1 from public.classes c
      where c.school_id = school and c.level_id = any (targets)
        and (c.id in (select public.guardian_class_ids(uid)) or c.id in (select public.teacher_class_ids(uid)))
    )
    when 'class' then exists (
      select 1 from unnest(targets) as t (class_id)
      where t.class_id in (select public.guardian_class_ids(uid)) or t.class_id in (select public.teacher_class_ids(uid))
    )
    when 'custom' then uid = any (targets)
  end;
$$;

create or replace function public.is_thread_member(thread uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.thread_members tm where tm.thread_id = thread and tm.user_id = uid);
$$;

create or replace function public.is_thread_moderator(thread uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.thread_members tm
    where tm.thread_id = thread and tm.user_id = uid and tm.role = 'moderator'
  ) or exists (
    select 1 from public.threads t where t.id = thread and t.created_by = uid
  );
$$;

create or replace function public.student_school_id(student uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select s.school_id from public.students s where s.id = student;
$$;

create or replace function public.class_school_id(class_ uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select c.school_id from public.classes c where c.id = class_;
$$;

-- Teacher of at least one class the student is currently enrolled in.
create or replace function public.teaches_student(student uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = student
      and (e.left_on is null or e.left_on >= current_date)
      and public.is_class_teacher(e.class_id, uid)
  );
$$;

-- Non read-only roles (guardians are read-only: no messaging, no posting).
create or replace function public.can_write_in_school(school uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_school_role(school, array['school_admin', 'staff', 'teacher', 'parent']::public.membership_role[], uid);
$$;

-- Who may see whose profile (name, avatar). Contact details go through directory opt-in views.
create or replace function public.can_view_profile(target uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select target = uid
    or public.is_super_admin(uid)
    -- staff of a school the target belongs to
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = target and tm.status = 'active' and public.is_school_staff(tm.school_id, uid)
    )
    -- direction, staff and teachers are visible to every member of their school
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = target and tm.status = 'active'
        and tm.role in ('school_admin', 'staff', 'teacher')
        and public.is_school_member(tm.school_id, uid)
    )
    -- a teacher sees the guardians of the students of their classes
    or exists (
      select 1 from public.student_guardians sg
      join public.enrollments e on e.student_id = sg.student_id
      where sg.user_id = target
        and (e.left_on is null or e.left_on >= current_date)
        and public.is_class_teacher(e.class_id, uid)
    )
    -- a guardian sees the other guardians of the same child only through directory opt-in,
    -- and fellow parents of the class only if they opted in
    or exists (
      select 1 from public.directory_optins d
      join public.student_guardians sg on sg.user_id = d.user_id and not sg.access_blocked
      join public.enrollments e on e.student_id = sg.student_id
      where d.user_id = target
        and (e.left_on is null or e.left_on >= current_date)
        and e.class_id in (select public.guardian_class_ids(uid))
    );
$$;

-- ── schools / years / levels ─────────────────────────────────────────────────
alter table public.schools enable row level security;
create policy schools_select on public.schools for select to authenticated
  using (public.is_school_member(id, (select auth.uid())));
create policy schools_insert on public.schools for insert to authenticated
  with check (public.is_super_admin((select auth.uid())));
create policy schools_update on public.schools for update to authenticated
  using (public.is_school_admin(id, (select auth.uid())))
  with check (public.is_school_admin(id, (select auth.uid())));
create policy schools_delete on public.schools for delete to authenticated
  using (public.is_super_admin((select auth.uid())));

alter table public.school_years enable row level security;
create policy school_years_select on public.school_years for select to authenticated
  using (public.is_school_member(school_id, (select auth.uid())));
create policy school_years_write on public.school_years for all to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_school_admin(school_id, (select auth.uid())));

alter table public.levels enable row level security;
create policy levels_select on public.levels for select to authenticated
  using (public.is_school_member(school_id, (select auth.uid())));
create policy levels_write on public.levels for all to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_school_admin(school_id, (select auth.uid())));

-- ── profiles / memberships ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_view_profile(id, (select auth.uid())));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using (exists (
    select 1 from public.memberships tm
    where tm.user_id = profiles.id and public.is_school_admin(tm.school_id, (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.memberships tm
    where tm.user_id = profiles.id and public.is_school_admin(tm.school_id, (select auth.uid()))
  ));

alter table public.memberships enable row level security;
create policy memberships_select on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_school_staff(school_id, (select auth.uid()))
    or (
      role in ('school_admin', 'staff', 'teacher')
      and public.has_school_role(school_id, array['teacher']::public.membership_role[], (select auth.uid()))
    )
  );
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    public.is_school_admin(school_id, (select auth.uid()))
    and (role <> 'super_admin' or public.is_super_admin((select auth.uid())))
  );
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (
    public.is_school_admin(school_id, (select auth.uid()))
    and (role <> 'super_admin' or public.is_super_admin((select auth.uid())))
  );
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())) and role <> 'super_admin');

-- ── classes / teachers / families / students / enrollments / guardians ───────
alter table public.classes enable row level security;
create policy classes_select on public.classes for select to authenticated
  using (public.is_school_member(school_id, (select auth.uid())));
create policy classes_write on public.classes for all to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_school_admin(school_id, (select auth.uid())));

alter table public.class_teachers enable row level security;
create policy class_teachers_select on public.class_teachers for select to authenticated
  using (public.is_school_member(public.class_school_id(class_id), (select auth.uid())));
create policy class_teachers_write on public.class_teachers for all to authenticated
  using (public.is_school_admin(public.class_school_id(class_id), (select auth.uid())))
  with check (public.is_school_admin(public.class_school_id(class_id), (select auth.uid())));

alter table public.families enable row level security;
create policy families_select on public.families for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or exists (
      select 1 from public.students s
      where s.family_id = families.id and s.id in (select public.guardian_student_ids((select auth.uid())))
    )
  );
create policy families_write on public.families for all to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));

alter table public.students enable row level security;
create policy students_select on public.students for select to authenticated
  using (
    public.can_access_student(id, (select auth.uid()))
    and (deleted_at is null or public.is_school_staff(school_id, (select auth.uid())))
  );
create policy students_write on public.students for all to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));

alter table public.student_private_notes enable row level security;
create policy student_private_notes_admin on public.student_private_notes for all to authenticated
  using (public.is_school_admin(public.student_school_id(student_id), (select auth.uid())))
  with check (public.is_school_admin(public.student_school_id(student_id), (select auth.uid())));

alter table public.enrollments enable row level security;
create policy enrollments_select on public.enrollments for select to authenticated
  using (
    public.can_access_student(student_id, (select auth.uid()))
    or public.can_access_class(class_id, (select auth.uid()))
  );
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.is_school_staff(public.class_school_id(class_id), (select auth.uid())))
  with check (public.is_school_staff(public.class_school_id(class_id), (select auth.uid())));

alter table public.student_guardians enable row level security;
create policy student_guardians_select on public.student_guardians for select to authenticated
  using (
    (user_id = (select auth.uid()) and not access_blocked)
    or public.is_school_staff(public.student_school_id(student_id), (select auth.uid()))
    or public.teaches_student(student_id, (select auth.uid()))
  );
create policy student_guardians_write on public.student_guardians for all to authenticated
  using (public.is_school_staff(public.student_school_id(student_id), (select auth.uid())))
  with check (public.is_school_staff(public.student_school_id(student_id), (select auth.uid())));

-- ── announcements ────────────────────────────────────────────────────────────
alter table public.announcements enable row level security;
create policy announcements_select on public.announcements for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or author_id = (select auth.uid())
    or (
      deleted_at is null
      and published_at is not null and published_at <= now()
      and (expires_at is null or expires_at > now())
      and public.matches_audience(school_id, audience, target_ids, (select auth.uid()))
    )
  );
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.is_school_staff(school_id, (select auth.uid())) and author_id = (select auth.uid()));
create policy announcements_update on public.announcements for update to authenticated
  using (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())));

alter table public.announcement_attachments enable row level security;
create policy announcement_attachments_select on public.announcement_attachments for select to authenticated
  using (exists (select 1 from public.announcements a where a.id = announcement_id));
create policy announcement_attachments_write on public.announcement_attachments for all to authenticated
  using (exists (
    select 1 from public.announcements a
    where a.id = announcement_id and public.is_school_staff(a.school_id, (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.announcements a
    where a.id = announcement_id and public.is_school_staff(a.school_id, (select auth.uid()))
  ));

alter table public.announcement_reads enable row level security;
create policy announcement_reads_select on public.announcement_reads for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.announcements a
      where a.id = announcement_id
        and (a.author_id = (select auth.uid()) or public.is_school_staff(a.school_id, (select auth.uid())))
    )
  );
create policy announcement_reads_insert on public.announcement_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.announcements a where a.id = announcement_id)
  );
create policy announcement_reads_update on public.announcement_reads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── class feed ───────────────────────────────────────────────────────────────
alter table public.class_posts enable row level security;
create policy class_posts_select on public.class_posts for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or author_id = (select auth.uid())
    or (
      deleted_at is null
      and published_at is not null and published_at <= now()
      and public.can_access_class(class_id, (select auth.uid()))
      and (visibility = 'parents' or public.is_class_teacher(class_id, (select auth.uid())))
    )
  );
create policy class_posts_insert on public.class_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and school_id = public.class_school_id(class_id)
    and (public.is_class_teacher(class_id, (select auth.uid())) or public.is_school_staff(school_id, (select auth.uid())))
  );
create policy class_posts_update on public.class_posts for update to authenticated
  using (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
  with check (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())));
create policy class_posts_delete on public.class_posts for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())));

alter table public.class_post_media enable row level security;
create policy class_post_media_select on public.class_post_media for select to authenticated
  using (exists (select 1 from public.class_posts p where p.id = post_id));
create policy class_post_media_write on public.class_post_media for all to authenticated
  using (exists (
    select 1 from public.class_posts p
    where p.id = post_id
      and (public.is_class_teacher(p.class_id, (select auth.uid())) or public.is_school_staff(p.school_id, (select auth.uid())))
  ))
  with check (exists (
    select 1 from public.class_posts p
    where p.id = post_id
      and (public.is_class_teacher(p.class_id, (select auth.uid())) or public.is_school_staff(p.school_id, (select auth.uid())))
  ));

alter table public.homework_completions enable row level security;
create policy homework_completions_select on public.homework_completions for select to authenticated
  using (public.can_access_student(student_id, (select auth.uid())));
create policy homework_completions_insert on public.homework_completions for insert to authenticated
  with check (
    marked_by_user_id = (select auth.uid())
    and (
      student_id in (select public.guardian_student_ids((select auth.uid())))
      or public.teaches_student(student_id, (select auth.uid()))
    )
    and exists (select 1 from public.class_posts p where p.id = post_id and p.type = 'homework')
  );
create policy homework_completions_delete on public.homework_completions for delete to authenticated
  using (marked_by_user_id = (select auth.uid()) or public.teaches_student(student_id, (select auth.uid())));

-- ── assessments ──────────────────────────────────────────────────────────────
alter table public.assessment_periods enable row level security;
create policy assessment_periods_select on public.assessment_periods for select to authenticated
  using (public.is_school_member(school_id, (select auth.uid())));
create policy assessment_periods_write on public.assessment_periods for all to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_school_admin(school_id, (select auth.uid())));

alter table public.skill_catalog enable row level security;
create policy skill_catalog_select on public.skill_catalog for select to authenticated
  using (public.is_school_member(school_id, (select auth.uid())));
create policy skill_catalog_write on public.skill_catalog for all to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_school_admin(school_id, (select auth.uid())));

alter table public.assessments enable row level security;
create policy assessments_select on public.assessments for select to authenticated
  using (
    public.is_class_teacher(class_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
    or (
      visible_to_parents
      and published_at is not null and published_at <= now()
      and public.can_view_student_grades(student_id, (select auth.uid()))
    )
  );
create policy assessments_insert on public.assessments for insert to authenticated
  with check (
    teacher_id = (select auth.uid())
    and public.is_class_teacher(class_id, (select auth.uid()))
    and school_id = public.class_school_id(class_id)
  );
create policy assessments_update on public.assessments for update to authenticated
  using (public.is_class_teacher(class_id, (select auth.uid())) or public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_class_teacher(class_id, (select auth.uid())) or public.is_school_admin(school_id, (select auth.uid())));
create policy assessments_delete on public.assessments for delete to authenticated
  using (teacher_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())));

-- ── individual notes ─────────────────────────────────────────────────────────
alter table public.individual_notes enable row level security;
create policy individual_notes_select on public.individual_notes for select to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_school_admin(school_id, (select auth.uid()))
    or public.teaches_student(student_id, (select auth.uid()))
    or (visibility = 'staff' and public.is_school_staff(school_id, (select auth.uid())))
    or (
      visibility = 'parents' and deleted_at is null
      and public.can_view_student_grades(student_id, (select auth.uid()))
    )
  );
create policy individual_notes_insert on public.individual_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and school_id = public.student_school_id(student_id)
    and (public.teaches_student(student_id, (select auth.uid())) or public.is_school_staff(school_id, (select auth.uid())))
  );
create policy individual_notes_update on public.individual_notes for update to authenticated
  using (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
  with check (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())));
create policy individual_notes_delete on public.individual_notes for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())));

alter table public.individual_note_reads enable row level security;
create policy individual_note_reads_select on public.individual_note_reads for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.individual_notes n
      where n.id = note_id and (n.author_id = (select auth.uid()) or public.is_school_admin(n.school_id, (select auth.uid())))
    )
  );
create policy individual_note_reads_insert on public.individual_note_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.individual_notes n where n.id = note_id));

-- ── absences ─────────────────────────────────────────────────────────────────
alter table public.absences enable row level security;
create policy absences_select on public.absences for select to authenticated
  using (public.can_access_student(student_id, (select auth.uid())));
create policy absences_insert on public.absences for insert to authenticated
  with check (
    declared_by = (select auth.uid())
    and school_id = public.student_school_id(student_id)
    and (
      student_id in (select public.guardian_student_ids((select auth.uid())))
      or public.is_school_staff(school_id, (select auth.uid()))
    )
  );
create policy absences_update on public.absences for update to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or (declared_by = (select auth.uid()) and status = 'declared')
  )
  with check (
    public.is_school_staff(school_id, (select auth.uid()))
    or (declared_by = (select auth.uid()) and status = 'declared')
  );
create policy absences_delete on public.absences for delete to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())));

-- ── events ───────────────────────────────────────────────────────────────────
alter table public.events enable row level security;
create policy events_select on public.events for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or created_by = (select auth.uid())
    or (
      deleted_at is null
      and public.matches_audience(school_id, scope::text::public.audience_kind, target_ids, (select auth.uid()))
    )
  );
create policy events_insert on public.events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.is_school_staff(school_id, (select auth.uid()))
      or (
        scope = 'class'
        and exists (
          select 1 from unnest(target_ids) as t (class_id)
          where public.is_class_teacher(t.class_id, (select auth.uid()))
        )
      )
    )
  );
create policy events_update on public.events for update to authenticated
  using (created_by = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
  with check (created_by = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())));
create policy events_delete on public.events for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())));

alter table public.event_rsvps enable row level security;
create policy event_rsvps_select on public.event_rsvps for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.created_by = (select auth.uid()) or public.is_school_staff(e.school_id, (select auth.uid())))
    )
  );
create policy event_rsvps_write on public.event_rsvps for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id));

alter table public.event_slots enable row level security;
create policy event_slots_select on public.event_slots for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy event_slots_write on public.event_slots for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and (e.created_by = (select auth.uid()) or public.is_school_staff(e.school_id, (select auth.uid())))
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_id and (e.created_by = (select auth.uid()) or public.is_school_staff(e.school_id, (select auth.uid())))
  ));

alter table public.event_slot_signups enable row level security;
create policy event_slot_signups_select on public.event_slot_signups for select to authenticated
  using (exists (select 1 from public.event_slots s where s.id = slot_id));
create policy event_slot_signups_write on public.event_slot_signups for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.event_slots s where s.id = slot_id));

-- ── documents / forms / appointments ─────────────────────────────────────────
alter table public.document_folders enable row level security;
create policy document_folders_select on public.document_folders for select to authenticated
  using (public.is_school_member(school_id, (select auth.uid())));
create policy document_folders_write on public.document_folders for all to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));

alter table public.documents enable row level security;
create policy documents_select on public.documents for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or (
      deleted_at is null
      and published_at is not null and published_at <= now()
      and public.matches_audience(school_id, audience, target_ids, (select auth.uid()))
    )
  );
create policy documents_write on public.documents for all to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));

alter table public.document_signatures enable row level security;
create policy document_signatures_select on public.document_signatures for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_school_staff(d.school_id, (select auth.uid()))
    )
  );
create policy document_signatures_insert on public.document_signatures for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.documents d where d.id = document_id)
    and (student_id is null or student_id in (select public.guardian_student_ids((select auth.uid()))))
  );

alter table public.forms enable row level security;
create policy forms_select on public.forms for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or (
      deleted_at is null
      and (opens_at is null or opens_at <= now())
      and public.matches_audience(school_id, audience, target_ids, (select auth.uid()))
    )
  );
create policy forms_write on public.forms for all to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));

alter table public.form_responses enable row level security;
create policy form_responses_select on public.form_responses for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.forms f where f.id = form_id and public.is_school_staff(f.school_id, (select auth.uid())))
  );
create policy form_responses_write on public.form_responses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.forms f where f.id = form_id and (f.closes_at is null or f.closes_at > now()))
    and (student_id is null or student_id in (select public.guardian_student_ids((select auth.uid()))))
  );

alter table public.appointment_slots enable row level security;
create policy appointment_slots_select on public.appointment_slots for select to authenticated
  using (public.can_access_class(class_id, (select auth.uid())));
create policy appointment_slots_teacher on public.appointment_slots for all to authenticated
  using (
    (teacher_id = (select auth.uid()) and public.is_class_teacher(class_id, (select auth.uid())))
    or public.is_school_staff(school_id, (select auth.uid()))
  )
  with check (
    (teacher_id = (select auth.uid()) and public.is_class_teacher(class_id, (select auth.uid())))
    or public.is_school_staff(school_id, (select auth.uid()))
  );
-- a guardian of the class books a free slot (or cancels their own booking)
create policy appointment_slots_book on public.appointment_slots for update to authenticated
  using (
    class_id in (select public.guardian_class_ids((select auth.uid())))
    and (booked_by is null or booked_by = (select auth.uid()))
  )
  with check (
    class_id in (select public.guardian_class_ids((select auth.uid())))
    and (booked_by is null or booked_by = (select auth.uid()))
    and (student_id is null or student_id in (select public.guardian_student_ids((select auth.uid()))))
  );

-- ── messaging ────────────────────────────────────────────────────────────────
alter table public.threads enable row level security;
create policy threads_select on public.threads for select to authenticated
  using (
    public.is_thread_member(id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
    or (kind = 'class_official' and public.can_access_class(class_id, (select auth.uid())))
  );
create policy threads_insert on public.threads for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_write_in_school(school_id, (select auth.uid()))
    and (
      (kind = 'dm')
      or (kind in ('class_group', 'class_official')
          and (public.is_class_teacher(class_id, (select auth.uid())) or public.is_school_staff(school_id, (select auth.uid()))))
      or (kind in ('event', 'custom') and public.is_school_staff(school_id, (select auth.uid())))
    )
  );
create policy threads_update on public.threads for update to authenticated
  using (public.is_thread_moderator(id, (select auth.uid())) or public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_thread_moderator(id, (select auth.uid())) or public.is_school_admin(school_id, (select auth.uid())));
create policy threads_delete on public.threads for delete to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())));

alter table public.thread_members enable row level security;
create policy thread_members_select on public.thread_members for select to authenticated
  using (
    public.is_thread_member(thread_id, (select auth.uid()))
    or exists (select 1 from public.threads t where t.id = thread_id and public.is_school_admin(t.school_id, (select auth.uid())))
  );
create policy thread_members_insert on public.thread_members for insert to authenticated
  with check (
    exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (
          public.is_thread_moderator(t.id, (select auth.uid()))
          or public.is_school_staff(t.school_id, (select auth.uid()))
          or (t.class_id is not null and public.is_class_teacher(t.class_id, (select auth.uid())))
          -- a DM creator adds the other party
          or (t.kind = 'dm' and t.created_by = (select auth.uid()))
        )
    )
  );
create policy thread_members_update on public.thread_members for update to authenticated
  using (user_id = (select auth.uid()) or public.is_thread_moderator(thread_id, (select auth.uid())))
  with check (user_id = (select auth.uid()) or public.is_thread_moderator(thread_id, (select auth.uid())));
create policy thread_members_delete on public.thread_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_thread_moderator(thread_id, (select auth.uid()))
    or exists (select 1 from public.threads t where t.id = thread_id and public.is_school_admin(t.school_id, (select auth.uid())))
  );

alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated
  using (
    public.is_thread_member(thread_id, (select auth.uid()))
    or exists (select 1 from public.threads t where t.id = thread_id and public.is_school_admin(t.school_id, (select auth.uid())))
  );
create policy messages_insert on public.messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and not t.locked and not t.archived
        and public.is_thread_member(t.id, (select auth.uid()))
        and public.can_write_in_school(t.school_id, (select auth.uid()))
        and (t.allow_replies or public.is_thread_moderator(t.id, (select auth.uid())))
    )
  );
create policy messages_update on public.messages for update to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_thread_moderator(thread_id, (select auth.uid()))
    or exists (select 1 from public.threads t where t.id = thread_id and public.is_school_admin(t.school_id, (select auth.uid())))
  )
  with check (
    author_id = (select auth.uid())
    or public.is_thread_moderator(thread_id, (select auth.uid()))
    or exists (select 1 from public.threads t where t.id = thread_id and public.is_school_admin(t.school_id, (select auth.uid())))
  );
create policy messages_delete on public.messages for delete to authenticated
  using (exists (select 1 from public.threads t where t.id = thread_id and public.is_school_admin(t.school_id, (select auth.uid()))));

alter table public.message_reactions enable row level security;
create policy message_reactions_select on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));
create policy message_reactions_write on public.message_reactions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.messages m where m.id = message_id));

alter table public.reports enable row level security;
create policy reports_select on public.reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or public.is_school_staff(school_id, (select auth.uid()))
    or exists (select 1 from public.messages m where m.id = message_id and public.is_thread_moderator(m.thread_id, (select auth.uid())))
  );
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and exists (select 1 from public.messages m where m.id = message_id));
create policy reports_update on public.reports for update to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));

-- ── community / notifications / legal / audit ────────────────────────────────
alter table public.directory_optins enable row level security;
create policy directory_optins_select on public.directory_optins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_school_staff(school_id, (select auth.uid())));
create policy directory_optins_write on public.directory_optins for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_school_member(school_id, (select auth.uid())));

alter table public.community_posts enable row level security;
create policy community_posts_select on public.community_posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_school_staff(school_id, (select auth.uid()))
    or (
      status = 'published' and deleted_at is null and expires_at > now()
      and public.is_school_member(school_id, (select auth.uid()))
    )
  );
create policy community_posts_insert on public.community_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_write_in_school(school_id, (select auth.uid())));
create policy community_posts_update on public.community_posts for update to authenticated
  using (author_id = (select auth.uid()) or public.is_school_staff(school_id, (select auth.uid())))
  with check (author_id = (select auth.uid()) or public.is_school_staff(school_id, (select auth.uid())));
create policy community_posts_delete on public.community_posts for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_school_staff(school_id, (select auth.uid())));

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- inserts happen server-side (service role / security definer functions, session 10)

alter table public.notification_preferences enable row level security;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.legal_documents enable row level security;
create policy legal_documents_select on public.legal_documents for select to authenticated
  using (true);
create policy legal_documents_write on public.legal_documents for all to authenticated
  using (
    (school_id is null and public.is_super_admin((select auth.uid())))
    or (school_id is not null and public.is_school_admin(school_id, (select auth.uid())))
  )
  with check (
    (school_id is null and public.is_super_admin((select auth.uid())))
    or (school_id is not null and public.is_school_admin(school_id, (select auth.uid())))
  );

alter table public.legal_acceptances enable row level security;
create policy legal_acceptances_select on public.legal_acceptances for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = legal_acceptances.user_id and public.is_school_staff(tm.school_id, (select auth.uid()))
    )
  );
create policy legal_acceptances_insert on public.legal_acceptances for insert to authenticated
  with check (user_id = (select auth.uid()));

alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log for select to authenticated
  using (school_id is not null and public.is_school_admin(school_id, (select auth.uid())));
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (actor_id = (select auth.uid()) and (school_id is null or public.is_school_member(school_id, (select auth.uid()))));
