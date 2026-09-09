-- Hardening after the security review of 2026-09-08 (docs/DECISIONS.md, ADR-0029).
-- 1. administrators must hold a two-factor session (aal2) for their rights to apply in RLS;
-- 2. id-listing helpers only answer about the caller (or for staff, fan-out and triggers);
-- 3. threads: explicit moderators only, DMs are closed, class threads follow current class
--    access, the per-guardian `can_message` right is enforced, moderation columns and
--    foreign keys are frozen by triggers;
-- 4. write policies re-validate school scoping on update, read-only guardians cannot sign,
--    answer forms, tick homework or book slots, parents cannot forge reviewed absences;
-- 5. audit rows are written by a function, never directly;
-- 6. notifications: lease on claimed deliveries, digest excludes pending e-mails, notes only
--    reach guardians allowed to read them, fan-out is scoped to the caller's schools.

-- ── 1. two-factor sessions for administrators ────────────────────────────────
-- Only the caller's own session can be checked: rights evaluated for other users (fan-out,
-- triggers, feeds) are not gated on it.
create or replace function public.has_strong_auth(uid uuid default auth.uid())
returns boolean
language sql stable
as $$
  select uid is distinct from auth.uid() or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.role = 'super_admin' and m.status = 'active'
  ) and public.has_strong_auth(uid);
$$;

create or replace function public.has_school_role(school uuid, roles public.membership_role[], uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.school_id = school and m.status = 'active' and m.role = any (roles)
      and (m.role <> 'school_admin' or public.has_strong_auth(uid))
  ) or public.is_super_admin(uid);
$$;

-- No user context at all: service role, migrations, seed. Anonymous requests never reach a
-- write path (no policy grants them anything).
create or replace function public.is_privileged_context()
returns boolean
language sql stable
as $$
  select public.is_service_role() or auth.uid() is null;
$$;

-- ── 2. helpers answering about other users ───────────────────────────────────
create or replace function public.may_inspect(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select uid = auth.uid()
    or auth.uid() is null
    or public.is_service_role()
    or pg_trigger_depth() > 0
    or public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.memberships me
      join public.memberships them on them.school_id = me.school_id and them.user_id = uid
      where me.user_id = auth.uid() and me.status = 'active'
        and me.role in ('school_admin', 'staff', 'teacher')
    );
$$;

create or replace function public.user_school_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct m.school_id from public.memberships m
  where public.may_inspect(uid) and m.user_id = uid and m.status = 'active';
$$;

-- A class teacher must also hold an active membership of the school.
create or replace function public.is_class_teacher(class_ uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.class_teachers ct
    join public.classes c on c.id = ct.class_id
    join public.memberships m on m.user_id = ct.user_id and m.school_id = c.school_id
      and m.status = 'active' and m.role in ('teacher', 'school_admin', 'staff')
    where ct.class_id = class_ and ct.user_id = uid
  );
$$;

create or replace function public.teacher_class_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select ct.class_id
  from public.class_teachers ct
  join public.classes c on c.id = ct.class_id
  join public.memberships m on m.user_id = ct.user_id and m.school_id = c.school_id
    and m.status = 'active' and m.role in ('teacher', 'school_admin', 'staff')
  where public.may_inspect(uid) and ct.user_id = uid;
$$;

-- (active membership in the child's school required, as in 20260908171200)
create or replace function public.guardian_student_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select sg.student_id
  from public.student_guardians sg
  join public.students s on s.id = sg.student_id
  join public.memberships m
    on m.user_id = sg.user_id and m.school_id = s.school_id
   and m.status = 'active' and m.role in ('parent', 'guardian')
  where public.may_inspect(uid) and sg.user_id = uid and not sg.access_blocked;
$$;

create or replace function public.guardian_class_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct e.class_id
  from public.student_guardians sg
  join public.students s on s.id = sg.student_id
  join public.memberships m
    on m.user_id = sg.user_id and m.school_id = s.school_id
   and m.status = 'active' and m.role in ('parent', 'guardian')
  join public.enrollments e on e.student_id = sg.student_id
  where public.may_inspect(uid)
    and sg.user_id = uid
    and not sg.access_blocked
    and (e.left_on is null or e.left_on >= current_date);
$$;

create or replace function public.effective_preference(uid uuid, kind text)
returns table (push boolean, email boolean, digest boolean, quiet_hours jsonb, shabbat_mode boolean)
language sql stable security definer set search_path = public
as $$
  with grp as (select public.notification_group(kind) as g),
  channel as (
    select p.push, p.email, p.digest
    from public.notification_preferences p, grp
    where p.user_id = uid and p.kind = grp.g
  ),
  global as (
    select p.quiet_hours, p.shabbat_mode
    from public.notification_preferences p
    where p.user_id = uid and p.kind = '*'
  )
  select
    coalesce((select push from channel), true),
    coalesce((select email from channel), (select g <> 'message' from grp)),
    coalesce((select digest from channel), true),
    coalesce((select quiet_hours from global), '{"start": "21:00", "end": "07:00"}'::jsonb),
    coalesce((select shabbat_mode from global), true)
  where public.may_inspect(uid);
$$;

-- Audiences are always resolved inside the school of the content.
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
      join public.classes c on c.id = t.class_id and c.school_id = school
      where c.id in (select public.guardian_class_ids(uid)) or c.id in (select public.teacher_class_ids(uid))
    )
    when 'custom' then uid = any (targets) and public.is_school_member(school, uid)
  end;
$$;

-- ── 3. threads and messages ──────────────────────────────────────────────────
-- Membership of a class thread follows the current access to the class (a blocked guardian or a
-- family whose child left the class drops out at once).
create or replace function public.is_thread_member(thread uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.thread_members tm
    join public.threads t on t.id = tm.thread_id
    where tm.thread_id = thread and tm.user_id = uid
      and (t.class_id is null or public.can_access_class(t.class_id, uid))
  );
$$;

-- Moderators are explicit members with the role, plus the school staff (moderation duty).
create or replace function public.is_thread_moderator(thread uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.thread_members tm
    where tm.thread_id = thread and tm.user_id = uid and tm.role = 'moderator'
  ) or exists (
    select 1 from public.threads t where t.id = thread and public.is_school_staff(t.school_id, uid)
  );
$$;

-- Per-guardian messaging right (student_guardians.can_message), optionally for a given class.
create or replace function public.parent_can_message(uid uuid, class_ uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.student_guardians sg
    join public.students s on s.id = sg.student_id
    join public.memberships m on m.user_id = sg.user_id and m.school_id = s.school_id
      and m.status = 'active' and m.role = 'parent'
    where sg.user_id = uid and sg.can_message and not sg.access_blocked
      and (class_ is null or exists (
        select 1 from public.enrollments e
        where e.student_id = sg.student_id and e.class_id = class_
          and (e.left_on is null or e.left_on >= current_date)
      ))
  );
$$;

create or replace function public.can_post_in_thread(thread uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.threads t
    where t.id = thread and not t.locked and not t.archived
      and public.is_thread_member(t.id, uid)
      and public.can_write_in_school(t.school_id, uid)
      and (t.allow_replies or public.is_thread_moderator(t.id, uid))
      and (
        public.is_school_staff(t.school_id, uid)
        or public.has_school_role(t.school_id, array['teacher']::public.membership_role[], uid)
        or public.parent_can_message(uid, t.class_id)
      )
  );
$$;

create or replace function public.can_direct_message(target uuid, uid uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  school uuid;
  caller_roles public.membership_role[];
  target_roles public.membership_role[];
  parent_to_parent boolean;
begin
  if target is null or target = uid then
    return false;
  end if;
  select m.school_id into school
  from public.memberships m
  where m.user_id = uid and m.status = 'active'
    and exists (select 1 from public.memberships t where t.user_id = target and t.school_id = m.school_id and t.status = 'active')
  limit 1;
  if school is null then
    return false;
  end if;
  if not public.can_write_in_school(school, uid) then
    return false; -- read-only guardians
  end if;
  select array_agg(role) into caller_roles from public.memberships where user_id = uid and school_id = school and status = 'active';
  select array_agg(role) into target_roles from public.memberships where user_id = target and school_id = school and status = 'active';

  -- staff / direction / teachers can reach anyone in the school
  if caller_roles && array['school_admin', 'staff', 'teacher', 'super_admin']::public.membership_role[] then
    return true;
  end if;
  -- caller is a parent: the messaging right of at least one child must be granted
  if not public.parent_can_message(uid) then
    return false;
  end if;
  if target_roles && array['school_admin', 'staff', 'super_admin']::public.membership_role[] then
    return true;
  end if;
  if 'teacher' = any (target_roles) then
    return exists (
      select 1 from public.class_teachers ct
      where ct.user_id = target and ct.class_id in (select public.guardian_class_ids(uid))
    );
  end if;
  select coalesce((s.modules -> 'messaging' ->> 'parentToParent')::boolean, false) into parent_to_parent
  from public.schools s where s.id = school;
  return parent_to_parent and (target_roles && array['parent']::public.membership_role[]);
end
$$;

-- Removes class-thread members who no longer qualify (blocked, child left, right withdrawn).
create or replace function public.prune_class_thread_members(class_ uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  delete from public.thread_members tm
  using public.threads t
  where t.id = tm.thread_id and t.class_id = class_ and tm.role = 'member'
    and (
      not public.can_access_class(t.class_id, tm.user_id)
      or (t.kind = 'class_group' and not (
        public.is_school_staff(t.school_id, tm.user_id)
        or public.is_class_teacher(t.class_id, tm.user_id)
        or public.parent_can_message(tm.user_id, t.class_id)
      ))
    );
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.prune_class_thread_members(uuid) from public, anon, authenticated;
grant execute on function public.prune_class_thread_members(uuid) to service_role;

create or replace function public.prune_thread_members_for_student()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid := coalesce(new.student_id, old.student_id);
  c uuid;
begin
  for c in select e.class_id from public.enrollments e where e.student_id = sid loop
    perform public.prune_class_thread_members(c);
  end loop;
  return null;
end
$$;
drop trigger if exists student_guardians_prune_threads on public.student_guardians;
create trigger student_guardians_prune_threads
  after update of access_blocked, can_message or delete on public.student_guardians
  for each row execute function public.prune_thread_members_for_student();

create or replace function public.prune_thread_members_for_enrollment()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.prune_class_thread_members(coalesce(new.class_id, old.class_id));
  return null;
end
$$;
drop trigger if exists enrollments_prune_threads on public.enrollments;
create trigger enrollments_prune_threads
  after update of left_on or delete on public.enrollments
  for each row execute function public.prune_thread_members_for_enrollment();

create or replace function public.ensure_class_threads(class_ uuid)
returns table (official uuid, parents_group uuid)
language plpgsql security definer set search_path = public
as $$
declare
  school uuid;
  official_id uuid;
  group_id uuid;
begin
  select c.school_id into school from public.classes c where c.id = class_;
  if school is null then
    raise exception 'Classe introuvable' using errcode = 'no_data_found';
  end if;
  if not (public.is_school_staff(school, auth.uid()) or public.is_class_teacher(class_, auth.uid())) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;

  select t.id into official_id from public.threads t where t.class_id = class_ and t.kind = 'class_official' and not t.archived limit 1;
  if official_id is null then
    insert into public.threads (school_id, kind, class_id, title, created_by, allow_replies)
    values (school, 'class_official', class_, 'Informations de la classe', auth.uid(), false)
    returning id into official_id;
  end if;
  select t.id into group_id from public.threads t where t.class_id = class_ and t.kind = 'class_group' and not t.archived limit 1;
  if group_id is null then
    insert into public.threads (school_id, kind, class_id, title, created_by, allow_replies)
    values (school, 'class_group', class_, 'Parents de la classe', auth.uid(), true)
    returning id into group_id;
  end if;

  insert into public.thread_members (thread_id, user_id, role)
  select t.id, ct.user_id, 'moderator'::public.thread_member_role
  from public.class_teachers ct cross join (values (official_id), (group_id)) as t (id)
  where ct.class_id = class_
  on conflict (thread_id, user_id) do update set role = 'moderator';

  -- official channel: every active, non-blocked parent (read-only channel)
  insert into public.thread_members (thread_id, user_id, role)
  select distinct official_id, sg.user_id, 'member'::public.thread_member_role
  from public.enrollments e
  join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
  join public.memberships m on m.user_id = sg.user_id and m.school_id = school and m.status = 'active' and m.role = 'parent'
  where e.class_id = class_ and (e.left_on is null or e.left_on >= current_date)
  on conflict do nothing;

  -- parents group: only guardians whose messaging right is granted
  insert into public.thread_members (thread_id, user_id, role)
  select distinct group_id, sg.user_id, 'member'::public.thread_member_role
  from public.enrollments e
  join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked and sg.can_message
  join public.memberships m on m.user_id = sg.user_id and m.school_id = school and m.status = 'active' and m.role = 'parent'
  where e.class_id = class_ and (e.left_on is null or e.left_on >= current_date)
  on conflict do nothing;

  perform public.prune_class_thread_members(class_);

  official := official_id;
  parents_group := group_id;
  return next;
end
$$;

-- Members may only change their own `muted` / `last_read_at`; roles change through the team.
create or replace function public.guard_thread_member_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  t public.threads%rowtype;
begin
  if public.is_privileged_context() then
    return new;
  end if;
  if new.thread_id <> old.thread_id or new.user_id <> old.user_id then
    raise exception 'Modification non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if new.role <> old.role then
    select * into t from public.threads where id = old.thread_id;
    if not (
      public.is_school_staff(t.school_id, auth.uid())
      or public.is_thread_moderator(old.thread_id, auth.uid())
      or (t.class_id is not null and public.is_class_teacher(t.class_id, auth.uid()))
    ) then
      raise exception 'Modification non autorisée' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists thread_members_guard on public.thread_members;
create trigger thread_members_guard before update on public.thread_members
  for each row execute function public.guard_thread_member_change();

-- Clients never set moderation or timestamp columns.
create or replace function public.guard_message_insert()
returns trigger
language plpgsql
as $$
begin
  if public.is_privileged_context() then
    return new;
  end if;
  new.moderated_by := null;
  new.moderation_reason := null;
  new.deleted_at := null;
  new.edited_at := null;
  new.created_at := now();
  return new;
end
$$;
drop trigger if exists messages_guard_insert on public.messages;
create trigger messages_guard_insert before insert on public.messages
  for each row execute function public.guard_message_insert();

create or replace function public.guard_message_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_privileged_context() then
    return new;
  end if;
  if new.thread_id <> old.thread_id or new.author_id is distinct from old.author_id or new.created_at <> old.created_at then
    raise exception 'Modification non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if (new.moderated_by is distinct from old.moderated_by or new.moderation_reason is distinct from old.moderation_reason)
     and not public.is_thread_moderator(old.thread_id, auth.uid()) then
    raise exception 'Modération réservée aux modérateurs' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update before update on public.messages
  for each row execute function public.guard_message_update();

-- Reports carry the school of the message and always start open.
create or replace function public.guard_report_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  school uuid;
begin
  if public.is_privileged_context() then
    return new;
  end if;
  select t.school_id into school
  from public.messages m join public.threads t on t.id = m.thread_id
  where m.id = new.message_id;
  if school is null then
    raise exception 'Message introuvable' using errcode = 'no_data_found';
  end if;
  new.school_id := school;
  new.reporter_id := auth.uid();
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  new.resolution_note := null;
  new.created_at := now();
  return new;
end
$$;
drop trigger if exists reports_guard_insert on public.reports;
create trigger reports_guard_insert before insert on public.reports
  for each row execute function public.guard_report_insert();

drop policy if exists thread_members_insert on public.thread_members;
create policy thread_members_insert on public.thread_members for insert to authenticated
  with check (
    exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.kind <> 'dm'
        and public.is_school_member(t.school_id, thread_members.user_id)
        and (
          public.is_thread_moderator(t.id, (select auth.uid()))
          or public.is_school_staff(t.school_id, (select auth.uid()))
          or (t.class_id is not null and public.is_class_teacher(t.class_id, (select auth.uid())))
        )
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_post_in_thread(thread_id, (select auth.uid())));

-- ── 4. frozen columns and re-validated updates ───────────────────────────────
-- Generic guard: the listed columns cannot change through the API.
create or replace function public.freeze_columns()
returns trigger
language plpgsql
as $$
declare
  col text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  if public.is_privileged_context() then
    return new;
  end if;
  foreach col in array tg_argv loop
    if n -> col is distinct from o -> col then
      raise exception 'La colonne % ne peut pas être modifiée', col using errcode = 'insufficient_privilege';
    end if;
  end loop;
  return new;
end
$$;

create trigger class_posts_freeze before update on public.class_posts
  for each row execute function public.freeze_columns('school_id', 'class_id', 'author_id');
create trigger individual_notes_freeze before update on public.individual_notes
  for each row execute function public.freeze_columns('school_id', 'student_id', 'author_id');
create trigger community_posts_freeze before update on public.community_posts
  for each row execute function public.freeze_columns('school_id', 'author_id');
create trigger announcements_freeze before update on public.announcements
  for each row execute function public.freeze_columns('school_id', 'author_id');
create trigger events_freeze before update on public.events
  for each row execute function public.freeze_columns('school_id', 'created_by');
create trigger documents_freeze before update on public.documents
  for each row execute function public.freeze_columns('school_id');
create trigger forms_freeze before update on public.forms
  for each row execute function public.freeze_columns('school_id', 'created_by');
create trigger absences_freeze before update on public.absences
  for each row execute function public.freeze_columns('school_id', 'student_id', 'declared_by');
create trigger assessments_freeze before update on public.assessments
  for each row execute function public.freeze_columns('school_id', 'class_id', 'student_id', 'period_id', 'skill_id');
create trigger assessment_remarks_freeze before update on public.assessment_remarks
  for each row execute function public.freeze_columns('school_id', 'class_id', 'student_id', 'period_id');
create trigger student_guardians_freeze before update on public.student_guardians
  for each row execute function public.freeze_columns('student_id', 'user_id');
create trigger enrollments_freeze before update on public.enrollments
  for each row execute function public.freeze_columns('student_id', 'class_id', 'school_year_id');
create trigger reports_freeze before update on public.reports
  for each row execute function public.freeze_columns('school_id', 'message_id', 'reporter_id');
create trigger event_rsvps_freeze before update on public.event_rsvps
  for each row execute function public.freeze_columns('event_id', 'user_id');
create trigger form_responses_freeze before update on public.form_responses
  for each row execute function public.freeze_columns('form_id', 'user_id', 'student_id');
create trigger appointment_slots_freeze before update on public.appointment_slots
  for each row execute function public.freeze_columns('school_id', 'class_id');

-- Court restriction: flipped by the direction only (the Server Action writes the audit entry).
create or replace function public.guard_guardian_block()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_privileged_context() then
    return new;
  end if;
  if new.access_blocked <> old.access_blocked
     and not public.is_school_admin(public.student_school_id(new.student_id), auth.uid()) then
    raise exception 'La restriction d''accès est réservée à la direction' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
drop trigger if exists student_guardians_guard_block on public.student_guardians;
create trigger student_guardians_guard_block before update on public.student_guardians
  for each row execute function public.guard_guardian_block();

-- Events: every target must belong to the school; teachers only target classes they teach.
create or replace function public.event_targets_valid(school uuid, scope public.event_scope, targets uuid[], uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select case scope
    when 'school' then public.is_school_staff(school, uid)
    when 'level' then public.is_school_staff(school, uid) and not exists (
      select 1 from unnest(targets) as l (id)
      where not exists (select 1 from public.levels lv where lv.id = l.id and lv.school_id = school)
    )
    when 'class' then coalesce(array_length(targets, 1), 0) > 0 and not exists (
      select 1 from unnest(targets) as c (id)
      where public.class_school_id(c.id) is distinct from school
         or not (public.is_school_staff(school, uid) or public.is_class_teacher(c.id, uid))
    )
  end;
$$;

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.event_targets_valid(school_id, scope, target_ids, (select auth.uid()))
  );
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (created_by = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
  with check (
    (created_by = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
    and public.event_targets_valid(school_id, scope, target_ids, (select auth.uid()))
  );

-- Read-only guardians: no signatures, form answers, homework ticks or bookings.
drop policy if exists document_signatures_insert on public.document_signatures;
create policy document_signatures_insert on public.document_signatures for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and public.can_write_in_school(d.school_id, (select auth.uid()))
    )
    and (student_id is null or student_id in (select public.guardian_student_ids((select auth.uid()))))
  );

drop policy if exists form_responses_write on public.form_responses;
create policy form_responses_write on public.form_responses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.forms f
      where f.id = form_id and (f.closes_at is null or f.closes_at > now())
        and public.can_write_in_school(f.school_id, (select auth.uid()))
    )
    and (student_id is null or student_id in (select public.guardian_student_ids((select auth.uid()))))
  );

drop policy if exists homework_completions_insert on public.homework_completions;
create policy homework_completions_insert on public.homework_completions for insert to authenticated
  with check (
    marked_by_user_id = (select auth.uid())
    and (
      (
        student_id in (select public.guardian_student_ids((select auth.uid())))
        and public.can_write_in_school(public.student_school_id(student_id), (select auth.uid()))
      )
      or public.teaches_student(student_id, (select auth.uid()))
    )
    and exists (select 1 from public.class_posts p where p.id = post_id and p.type = 'homework')
  );

-- Bookings only through book_appointment / cancel_appointment; parents see free slots and their own.
drop policy if exists appointment_slots_book on public.appointment_slots;
drop policy if exists appointment_slots_select on public.appointment_slots;
create policy appointment_slots_select on public.appointment_slots for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or public.is_class_teacher(class_id, (select auth.uid()))
    or (
      class_id in (select public.guardian_class_ids((select auth.uid())))
      and (booked_by is null or booked_by = (select auth.uid()))
    )
  );

-- Parents declare absences as `declared`, never reviewed.
drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences for insert to authenticated
  with check (
    declared_by = (select auth.uid())
    and school_id = public.student_school_id(student_id)
    and (
      (
        student_id in (select public.guardian_student_ids((select auth.uid())))
        and public.can_write_in_school(school_id, (select auth.uid()))
        and status = 'declared' and reviewed_by is null and reviewed_at is null
      )
      or public.is_school_staff(school_id, (select auth.uid()))
    )
  );
drop policy if exists absences_update on public.absences;
create policy absences_update on public.absences for update to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or (declared_by = (select auth.uid()) and status = 'declared')
  )
  with check (
    public.is_school_staff(school_id, (select auth.uid()))
    or (declared_by = (select auth.uid()) and status = 'declared' and reviewed_by is null and reviewed_at is null)
  );

-- Updates re-check the same scoping as inserts.
drop policy if exists class_posts_update on public.class_posts;
create policy class_posts_update on public.class_posts for update to authenticated
  using (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
  with check (
    (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
    and school_id = public.class_school_id(class_id)
    and (public.is_class_teacher(class_id, (select auth.uid())) or public.is_school_staff(school_id, (select auth.uid())))
  );
drop policy if exists individual_notes_update on public.individual_notes;
create policy individual_notes_update on public.individual_notes for update to authenticated
  using (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
  with check (
    (author_id = (select auth.uid()) or public.is_school_admin(school_id, (select auth.uid())))
    and school_id = public.student_school_id(student_id)
    and (public.teaches_student(student_id, (select auth.uid())) or public.is_school_staff(school_id, (select auth.uid())))
  );
drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update on public.community_posts for update to authenticated
  using (author_id = (select auth.uid()) or public.is_school_staff(school_id, (select auth.uid())))
  with check (
    (author_id = (select auth.uid()) or public.is_school_staff(school_id, (select auth.uid())))
    and public.can_write_in_school(school_id, (select auth.uid()))
  );

-- Cross-school references are refused at write time.
drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes for all to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (
    public.is_school_admin(school_id, (select auth.uid()))
    and exists (select 1 from public.levels l where l.id = level_id and l.school_id = classes.school_id)
    and exists (select 1 from public.school_years y where y.id = school_year_id and y.school_id = classes.school_id)
  );
drop policy if exists enrollments_write on public.enrollments;
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.is_school_staff(public.class_school_id(class_id), (select auth.uid())))
  with check (
    public.is_school_staff(public.class_school_id(class_id), (select auth.uid()))
    and public.student_school_id(student_id) = public.class_school_id(class_id)
    and exists (select 1 from public.school_years y where y.id = school_year_id and y.school_id = public.class_school_id(class_id))
  );
drop policy if exists class_teachers_write on public.class_teachers;
create policy class_teachers_write on public.class_teachers for all to authenticated
  using (public.is_school_admin(public.class_school_id(class_id), (select auth.uid())))
  with check (
    public.is_school_admin(public.class_school_id(class_id), (select auth.uid()))
    and public.has_school_role(public.class_school_id(class_id), array['teacher', 'school_admin', 'staff']::public.membership_role[], class_teachers.user_id)
  );

-- Assessments concern pupils currently enrolled in the class.
create or replace function public.is_enrolled(student uuid, class_ uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = student and e.class_id = class_ and (e.left_on is null or e.left_on >= current_date)
  );
$$;
drop policy if exists assessments_insert on public.assessments;
create policy assessments_insert on public.assessments for insert to authenticated
  with check (
    teacher_id = (select auth.uid())
    and public.is_class_teacher(class_id, (select auth.uid()))
    and school_id = public.class_school_id(class_id)
    and public.is_enrolled(student_id, class_id)
  );
drop policy if exists assessment_remarks_write on public.assessment_remarks;
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
    and public.is_enrolled(student_id, class_id)
  );

-- Photo tags only name pupils of the post's class.
create or replace function public.check_media_tags()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  missing text;
  cls uuid;
begin
  if array_length(new.tagged_student_ids, 1) is null then
    return new;
  end if;
  select p.class_id into cls from public.class_posts p where p.id = new.post_id;
  if exists (
    select 1 from unnest(new.tagged_student_ids) as t (id)
    where not public.is_enrolled(t.id, cls)
  ) then
    raise exception 'Seuls les élèves de la classe peuvent être identifiés' using errcode = 'check_violation';
  end if;
  select string_agg(s.first_name || ' ' || s.last_name, ', ')
    into missing
  from public.students s
  where s.id = any (new.tagged_student_ids) and s.image_rights_signed_at is null;
  if missing is not null then
    raise exception 'Droit à l''image non signé pour : %', missing using errcode = 'check_violation';
  end if;
  return new;
end
$$;

-- Class media: readable when the post itself is (drafts and staff-only posts stay hidden).
drop policy if exists storage_class_media_select on storage.objects;
create policy storage_class_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'class-media'
    and exists (
      select 1 from public.class_posts p
      where p.id = public.try_uuid((storage.foldername(name))[3])
        and p.class_id = public.try_uuid((storage.foldername(name))[2])
    )
  );
drop policy if exists storage_class_media_write on storage.objects;
create policy storage_class_media_write on storage.objects for all to authenticated
  using (
    bucket_id = 'class-media'
    and public.class_school_id(public.try_uuid((storage.foldername(name))[2])) = public.try_uuid((storage.foldername(name))[1])
    and (
      public.is_class_teacher(public.try_uuid((storage.foldername(name))[2]), (select auth.uid()))
      or public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'class-media'
    and public.class_school_id(public.try_uuid((storage.foldername(name))[2])) = public.try_uuid((storage.foldername(name))[1])
    and (
      public.is_class_teacher(public.try_uuid((storage.foldername(name))[2]), (select auth.uid()))
      or public.is_school_staff(public.try_uuid((storage.foldername(name))[1]), (select auth.uid()))
    )
  );

-- ── 5. audit log written by a function only ──────────────────────────────────
create or replace function public.log_audit(school uuid, action text, entity text, entity_id uuid default null, diff jsonb default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    if not public.is_service_role() then
      raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
    end if;
  elsif school is not null and not public.is_school_member(school, actor) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  elsif not (
    action like 'security.%'
    or public.is_super_admin(actor)
    or (school is not null and public.has_school_role(school, array['school_admin', 'staff', 'teacher']::public.membership_role[], actor))
  ) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  values (school, actor, action, entity, entity_id, diff);
end
$$;
revoke all on function public.log_audit(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb) to authenticated, service_role;
drop policy if exists audit_log_insert on public.audit_log;

-- Audit rows and moderation records survive the deletion of what they describe.
alter table public.audit_log drop constraint if exists audit_log_school_id_fkey;
alter table public.audit_log add constraint audit_log_school_id_fkey
  foreign key (school_id) references public.schools (id) on delete set null;
alter table public.reports alter column message_id drop not null;
alter table public.reports drop constraint if exists reports_message_id_fkey;
alter table public.reports add constraint reports_message_id_fkey
  foreign key (message_id) references public.messages (id) on delete set null;

-- ── 6. notifications and feeds ───────────────────────────────────────────────
alter table public.notification_deliveries add column if not exists claimed_at timestamptz;

create or replace function public.claim_notification_deliveries(batch integer default 100)
returns table (
  delivery_id uuid, channel public.notification_channel, attempts smallint,
  notification_id uuid, user_id uuid, kind text, payload jsonb, created_at timestamptz,
  email text, locale text, first_name text,
  quiet_hours jsonb, shabbat_mode boolean,
  school_id uuid, timezone text, latitude double precision, longitude double precision
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_service_role() then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
    with claimed as (
      update public.notification_deliveries d
      set attempts = d.attempts + 1, claimed_at = now()
      where d.id in (
        select x.id from public.notification_deliveries x
        where x.sent_at is null and x.scheduled_for <= now() and x.attempts < 5
          and (x.claimed_at is null or x.claimed_at < now() - interval '2 minutes')
        order by x.scheduled_for
        limit batch
        for update skip locked
      )
      returning d.*
    )
    select c.id, c.channel, c.attempts, n.id, n.user_id, n.kind, n.payload, n.created_at,
           u.email::text, coalesce(p.locale, 'fr'), coalesce(p.first_name, ''),
           pref.quiet_hours, pref.shabbat_mode,
           n.school_id, s.timezone, s.latitude, s.longitude
    from claimed c
    join public.notifications n on n.id = c.notification_id
    join auth.users u on u.id = n.user_id
    left join public.profiles p on p.id = n.user_id
    left join public.schools s on s.id = n.school_id
    cross join lateral public.effective_preference(n.user_id, n.kind) pref;
end
$$;

-- A notification with a planned e-mail (sent or pending) is never digested as well.
create or replace function public.digest_candidates(since timestamptz)
returns table (
  user_id uuid, email text, locale text, first_name text, quiet_hours jsonb, shabbat_mode boolean,
  school_id uuid, timezone text, latitude double precision, longitude double precision,
  notification_id uuid, kind text, payload jsonb, created_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_service_role() then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
    select n.user_id, u.email::text, p.locale, p.first_name, pref.quiet_hours, pref.shabbat_mode,
           n.school_id, s.timezone, s.latitude, s.longitude,
           n.id, n.kind, n.payload, n.created_at
    from public.notifications n
    join auth.users u on u.id = n.user_id
    join public.profiles p on p.id = n.user_id
    left join public.schools s on s.id = n.school_id
    cross join lateral public.effective_preference(n.user_id, n.kind) pref
    where n.created_at >= since and n.read_at is null and n.digested_at is null and n.channel = 'inapp'
      and pref.digest
      and not exists (
        select 1 from public.notification_deliveries d
        where d.notification_id = n.id and d.channel = 'email'
      )
    order by n.user_id, n.created_at;
end
$$;

-- Individual notes only reach the guardians allowed to read them.
create or replace function public.notify_individual_note()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s record;
begin
  if new.visibility::text = 'staff' or new.deleted_at is not null then
    return new;
  end if;
  select st.first_name || ' ' || st.last_name as student_name, e.class_id
  into s
  from public.students st
  left join public.enrollments e on e.student_id = st.id and (e.left_on is null or e.left_on >= current_date)
  where st.id = new.student_id
  order by e.joined_on desc nulls last
  limit 1;
  insert into public.notifications (user_id, school_id, kind, payload)
  select sg.user_id, new.school_id, 'note.new',
         jsonb_build_object('note_id', new.id, 'student_id', new.student_id, 'student_name', s.student_name,
                            'class_id', s.class_id, 'kind', new.kind)
  from public.student_guardians sg
  join public.memberships m on m.user_id = sg.user_id and m.school_id = new.school_id and m.status = 'active'
  where sg.student_id = new.student_id and not sg.access_blocked and sg.receives_notifications
    and public.can_view_student_grades(new.student_id, sg.user_id)
    and (new.author_id is null or sg.user_id <> new.author_id);
  return new;
end
$$;

-- Interactive fan-out is limited to the caller's schools.
create or replace function public.notify_due_content()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n integer;
  total integer := 0;
  everywhere boolean := public.is_service_role();
begin
  if not everywhere and not exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.role in ('school_admin', 'staff', 'teacher')
  ) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;

  for r in
    select * from public.announcements
    where published_at is not null and published_at <= now() and notified_at is null and deleted_at is null
      and (everywhere or school_id in (select public.user_school_ids(auth.uid())))
    for update skip locked
  loop
    insert into public.notifications (user_id, school_id, kind, payload)
    select m.user_id, r.school_id, 'announcement.new',
           jsonb_build_object('announcement_id', r.id, 'title', r.title, 'requires_ack', r.requires_ack)
    from (
      select distinct m.user_id from public.memberships m
      where m.school_id = r.school_id and m.status = 'active'
        and m.role in ('parent', 'guardian', 'teacher', 'staff', 'school_admin')
        and public.matches_audience(r.school_id, r.audience, r.target_ids, m.user_id)
    ) m
    where r.author_id is null or m.user_id <> r.author_id;
    get diagnostics n = row_count;
    total := total + n;
    update public.announcements set notified_at = now() where id = r.id;
  end loop;

  for r in
    select * from public.documents
    where published_at is not null and published_at <= now() and notified_at is null and deleted_at is null
      and (everywhere or school_id in (select public.user_school_ids(auth.uid())))
    for update skip locked
  loop
    insert into public.notifications (user_id, school_id, kind, payload)
    select m.user_id, r.school_id, 'document.new',
           jsonb_build_object('document_id', r.id, 'title', r.title, 'requires_signature', r.requires_signature)
    from (
      select distinct m.user_id from public.memberships m
      where m.school_id = r.school_id and m.status = 'active'
        and m.role in ('parent', 'guardian', 'teacher', 'staff', 'school_admin')
        and public.matches_audience(r.school_id, r.audience, r.target_ids, m.user_id)
    ) m
    where r.created_by is null or m.user_id <> r.created_by;
    get diagnostics n = row_count;
    total := total + n;
    update public.documents set notified_at = now() where id = r.id;
  end loop;

  for r in
    select p.*, c.name as class_name from public.class_posts p
    join public.classes c on c.id = p.class_id
    where p.published_at is not null and p.published_at <= now() and p.notified_at is null
      and p.deleted_at is null and p.visibility::text <> 'staff'
      and (everywhere or p.school_id in (select public.user_school_ids(auth.uid())))
    for update of p skip locked
  loop
    insert into public.notifications (user_id, school_id, kind, payload)
    select g, r.school_id, 'class_post.new',
           jsonb_build_object('post_id', r.id, 'class_id', r.class_id, 'class_name', r.class_name,
                              'type', r.type, 'title', r.title, 'due_on', r.due_on)
    from public.class_notification_recipients(r.class_id) g
    where r.author_id is null or g <> r.author_id;
    get diagnostics n = row_count;
    total := total + n;
    update public.class_posts set notified_at = now() where id = r.id;
  end loop;

  return total;
end
$$;

-- The ICS feed of a former member stops carrying the events they created.
create or replace function public.calendar_feed_events(feed_token text)
returns table (
  id uuid, title text, description_md text, starts_at timestamptz, ends_at timestamptz, all_day boolean,
  location text, kind public.event_kind, scope public.event_scope, requires_rsvp boolean,
  my_status public.rsvp_status, waitlisted boolean, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select e.id, e.title, e.description_md, e.starts_at, e.ends_at, e.all_day, e.location, e.kind, e.scope,
         e.requires_rsvp, r.status, coalesce(r.waitlisted, false), e.created_at, e.updated_at
  from public.calendar_feeds f
  join public.events e on e.deleted_at is null
  join public.school_years y on y.school_id = e.school_id and y.is_current
  left join public.event_rsvps r on r.event_id = e.id and r.user_id = f.user_id
  where f.token = feed_token
    and e.starts_at >= y.starts_on::timestamptz - interval '30 days'
    and public.is_school_member(e.school_id, f.user_id)
    and (
      public.is_school_staff(e.school_id, f.user_id)
      or e.created_by = f.user_id
      or public.matches_audience(e.school_id, e.scope::text::public.audience_kind, e.target_ids, f.user_id)
    )
  order by e.starts_at;
$$;

-- Leaving a school (suspension, removal) revokes feeds, push subscriptions and thread memberships.
create or replace function public.cleanup_inactive_membership()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  school uuid := coalesce(new.school_id, old.school_id);
begin
  if tg_op = 'UPDATE' and new.status = 'active' then
    return null;
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.school_id = school and m.status = 'active'
  ) then
    delete from public.thread_members tm
    using public.threads t
    where t.id = tm.thread_id and t.school_id = school and tm.user_id = uid;
  end if;
  if not exists (select 1 from public.memberships m where m.user_id = uid and m.status = 'active') then
    delete from public.push_subscriptions where user_id = uid;
    delete from public.calendar_feeds where user_id = uid;
  end if;
  return null;
end
$$;
drop trigger if exists memberships_cleanup_inactive on public.memberships;
create trigger memberships_cleanup_inactive
  after update of status or delete on public.memberships
  for each row execute function public.cleanup_inactive_membership();
