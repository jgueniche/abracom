-- Assessments (session 11): per-period remarks, publication with family notification,
-- co-teachers may clear cells, notification group for assessments.

create table public.assessment_remarks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  period_id uuid not null references public.assessment_periods (id) on delete cascade,
  teacher_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, period_id)
);
create index assessment_remarks_class_period_idx on public.assessment_remarks (class_id, period_id);
create trigger assessment_remarks_set_updated_at
  before update on public.assessment_remarks
  for each row execute function public.set_updated_at();

alter table public.assessment_remarks enable row level security;
create policy assessment_remarks_select on public.assessment_remarks for select to authenticated
  using (
    public.is_class_teacher(class_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
    or (
      public.can_view_student_grades(student_id, (select auth.uid()))
      and exists (
        select 1 from public.assessments a
        where a.student_id = assessment_remarks.student_id
          and a.period_id = assessment_remarks.period_id
          and a.visible_to_parents and a.published_at is not null and a.published_at <= now()
      )
    )
  );
create policy assessment_remarks_write on public.assessment_remarks for all to authenticated
  using (
    public.is_class_teacher(class_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
  )
  with check (
    (
      public.is_class_teacher(class_id, (select auth.uid()))
      or public.is_school_admin(school_id, (select auth.uid()))
    )
    and school_id = public.class_school_id(class_id)
  );

-- Any teacher of the class may clear a cell, not only its author.
drop policy assessments_delete on public.assessments;
create policy assessments_delete on public.assessments for delete to authenticated
  using (
    public.is_class_teacher(class_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
  );

-- Publication per class and period: every entered assessment becomes visible to the families
-- allowed to see grades, who are notified once. Idempotent (unpublished rows only).
create or replace function public.publish_assessments(class_ uuid, period uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  school uuid;
  period_label text;
  -- now() (transaction time) so the `published_at <= now()` policy holds in the same transaction
  ts timestamptz := now();
  published integer;
begin
  select c.school_id into school from public.classes c where c.id = class_;
  if school is null then
    raise exception 'Classe introuvable' using errcode = 'no_data_found';
  end if;
  if not (public.is_class_teacher(class_, auth.uid()) or public.is_school_admin(school, auth.uid())) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  select p.label into period_label from public.assessment_periods p where p.id = period;

  update public.assessments a
  set published_at = ts, visible_to_parents = true
  where a.class_id = class_ and a.period_id = period and a.published_at is null;
  get diagnostics published = row_count;

  if published > 0 then
    insert into public.notifications (user_id, school_id, kind, payload)
    select distinct sg.user_id, school, 'assessment.published',
           jsonb_build_object('student_id', s.id, 'student_name', s.first_name || ' ' || s.last_name,
                              'class_id', class_, 'period_id', period, 'period_label', period_label)
    from (
      select distinct a.student_id from public.assessments a
      where a.class_id = class_ and a.period_id = period and a.published_at = ts
    ) t
    join public.students s on s.id = t.student_id
    join public.student_guardians sg on sg.student_id = s.id
      and sg.can_view_grades and sg.receives_notifications and not sg.access_blocked
    join public.memberships m on m.user_id = sg.user_id and m.school_id = school
      and m.status = 'active' and m.role = 'parent';
  end if;

  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  values (school, auth.uid(), 'assessments.publish', 'assessment_periods', period,
          jsonb_build_object('class_id', class_, 'published', published));
  return published;
end
$$;
revoke all on function public.publish_assessments(uuid, uuid) from public, anon;
grant execute on function public.publish_assessments(uuid, uuid) to authenticated, service_role;

-- Assessment notifications belong to the "class" preference group.
create or replace function public.notification_group(kind text)
returns text
language sql immutable
as $$
  select case
    when kind like 'announcement.%' then 'announcement'
    when kind like 'document.%' then 'document'
    when kind like 'class_post.%' or kind like 'note.%' or kind like 'assessment.%' then 'class'
    when kind like 'message.%' then 'message'
    when kind like 'event.%' then 'event'
    when kind like 'absence.%' then 'absence'
    when kind like 'report.%' then 'moderation'
    when kind like 'community.%' then 'community'
    else 'other'
  end;
$$;
