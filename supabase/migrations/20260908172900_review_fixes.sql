-- Regression fixes after the hardening review (ADR-0029 follow-up).

-- 1. People who were invited must see the school that invited them (onboarding lists the
--    invitations by name before any membership is active).
drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools for select to authenticated
  using (
    public.is_school_member(id, (select auth.uid()))
    or exists (
      select 1 from public.memberships m
      where m.user_id = (select auth.uid()) and m.school_id = schools.id and m.status = 'invited'
    )
  );

-- 2. Teachers are assigned to classes before the school year starts, often before they accepted
--    their invitation; they gain nothing until activation (is_class_teacher requires it).
drop policy if exists class_teachers_write on public.class_teachers;
create policy class_teachers_write on public.class_teachers for all to authenticated
  using (public.is_school_admin(public.class_school_id(class_id), (select auth.uid())))
  with check (
    public.is_school_admin(public.class_school_id(class_id), (select auth.uid()))
    and exists (
      select 1 from public.memberships m
      where m.user_id = class_teachers.user_id
        and m.school_id = public.class_school_id(class_id)
        and m.status in ('active', 'invited')
        and m.role in ('teacher', 'school_admin', 'staff')
    )
  );

-- 3. Moderation duty stays with the direction: the secretariat cannot read threads it is not
--    part of, so it must not be a moderator of them either.
create or replace function public.is_thread_moderator(thread uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.thread_members tm
    where tm.thread_id = thread and tm.user_id = uid and tm.role = 'moderator'
  ) or exists (
    select 1 from public.threads t where t.id = thread and public.is_school_admin(t.school_id, uid)
  );
$$;

-- 4. Referential actions (a deleted message sets reports.message_id to null) and mid-year class
--    changes (assessment rows follow the pupil) must not be blocked by the frozen columns.
drop trigger if exists reports_freeze on public.reports;
create trigger reports_freeze before update on public.reports
  for each row execute function public.freeze_columns('school_id', 'reporter_id');
drop trigger if exists assessments_freeze on public.assessments;
create trigger assessments_freeze before update on public.assessments
  for each row execute function public.freeze_columns('school_id', 'student_id', 'period_id', 'skill_id');
drop trigger if exists assessment_remarks_freeze on public.assessment_remarks;
create trigger assessment_remarks_freeze before update on public.assessment_remarks
  for each row execute function public.freeze_columns('school_id', 'student_id', 'period_id');
