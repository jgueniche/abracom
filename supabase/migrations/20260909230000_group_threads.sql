-- Discussion groups created from the app.
--
-- Until now the only groups were the two the platform created per class
-- (`ensure_class_threads`), so a trip, a project or a level-wide subject had
-- nowhere to live. Picking one or several classes adds every guardian of every
-- pupil enrolled in them at once — the point being that nobody assembles a
-- recipient list by hand.
--
-- Who may create one: the school team anywhere in their school, a teacher for
-- the classes they teach. Parents keep direct messages and the class group.

create or replace function public.create_group_thread(
  title_ text,
  class_ids uuid[] default '{}'::uuid[],
  include_teachers boolean default true,
  extra_user_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  school uuid;
  thread uuid;
  clean_title text := nullif(btrim(coalesce(title_, '')), '');
  classes uuid[] := coalesce(class_ids, '{}'::uuid[]);
  extras uuid[] := coalesce(extra_user_ids, '{}'::uuid[]);
begin
  if me is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if clean_title is null or char_length(clean_title) > 120 then
    raise exception 'Titre invalide' using errcode = 'check_violation';
  end if;

  if coalesce(array_length(classes, 1), 0) = 0 then
    -- No class: the group is a free list of people, in the caller's school.
    select m.school_id into school
    from public.memberships m
    where m.user_id = me and m.status = 'active'
      and m.role in ('school_admin', 'staff', 'teacher')
    order by m.role
    limit 1;
  else
    -- Every listed class must exist and belong to one and the same school.
    if (select count(distinct c.school_id) from public.classes c where c.id = any (classes)) <> 1
      or (select count(*) from public.classes c where c.id = any (classes))
         <> (select count(distinct x) from unnest(classes) as x)
    then
      raise exception 'Classes invalides' using errcode = 'check_violation';
    end if;
    select c.school_id into school from public.classes c where c.id = any (classes) limit 1;
  end if;

  if school is null then
    raise exception 'École introuvable' using errcode = 'no_data_found';
  end if;

  if not public.is_school_staff(school, me) then
    if not public.has_school_role(school, array['teacher']::public.membership_role[], me) then
      raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
    end if;
    if exists (
      select 1 from unnest(classes) as x(id) where not public.is_class_teacher(x.id, me)
    ) then
      raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into public.threads (school_id, kind, title, created_by, allow_replies)
  values (school, 'custom', clean_title, me, true)
  returning id into thread;

  insert into public.thread_members (thread_id, user_id, role)
  values (thread, me, 'moderator')
  on conflict (thread_id, user_id) do update set role = 'moderator';

  -- Every guardian of every pupil currently enrolled in the listed classes,
  -- minus the ones a court order keeps out (student_guardians.access_blocked).
  insert into public.thread_members (thread_id, user_id, role)
  select distinct thread, sg.user_id, 'member'::public.thread_member_role
  from public.enrollments e
  join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
  join public.memberships m on m.user_id = sg.user_id and m.school_id = school
    and m.status = 'active' and m.role = 'parent'
  where e.class_id = any (classes)
    and (e.left_on is null or e.left_on >= current_date)
  on conflict do nothing;

  if include_teachers then
    insert into public.thread_members (thread_id, user_id, role)
    select distinct thread, ct.user_id, 'moderator'::public.thread_member_role
    from public.class_teachers ct
    where ct.class_id = any (classes)
    on conflict (thread_id, user_id) do update set role = 'moderator';
  end if;

  -- Hand-picked people, restricted to active members of the same school.
  insert into public.thread_members (thread_id, user_id, role)
  select distinct thread, m.user_id, 'member'::public.thread_member_role
  from public.memberships m
  where m.user_id = any (extras) and m.school_id = school and m.status = 'active'
  on conflict do nothing;

  return thread;
end
$$;
revoke all on function public.create_group_thread(text, uuid[], boolean, uuid[]) from public, anon;
grant execute on function public.create_group_thread(text, uuid[], boolean, uuid[])
  to authenticated, service_role;

-- A teacher may now own a `custom` thread, so the direct-insert policy has to
-- say so too — the function bypasses RLS, the policy is what a client sees.
drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_write_in_school(school_id, (select auth.uid()))
    and (
      (kind = 'dm')
      or (kind in ('class_group', 'class_official')
          and (public.is_class_teacher(class_id, (select auth.uid()))
               or public.is_school_staff(school_id, (select auth.uid()))))
      or (kind = 'custom'
          and (public.is_school_staff(school_id, (select auth.uid()))
               or public.has_school_role(
                    school_id, array['teacher']::public.membership_role[], (select auth.uid()))))
      or (kind = 'event' and public.is_school_staff(school_id, (select auth.uid())))
    )
  );

-- Classes a group can be built from: the ones the caller may publish to.
create or replace function public.group_target_classes()
returns table (id uuid, name text, level_code text, guardians bigint)
language sql stable security definer set search_path = public
as $$
  select c.id, c.name, l.code::text,
    (select count(distinct sg.user_id)
     from public.enrollments e
     join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
     join public.memberships m on m.user_id = sg.user_id and m.school_id = c.school_id
       and m.status = 'active' and m.role = 'parent'
     where e.class_id = c.id and (e.left_on is null or e.left_on >= current_date))
  from public.classes c
  join public.levels l on l.id = c.level_id
  join public.school_years y on y.id = c.school_year_id and y.is_current
  where not c.archived
    and (public.is_school_staff(c.school_id, auth.uid()) or public.is_class_teacher(c.id, auth.uid()))
  order by l.sort_order, c.name;
$$;
revoke all on function public.group_target_classes() from public, anon;
grant execute on function public.group_target_classes() to authenticated, service_role;
