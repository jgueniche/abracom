-- Session 8: realtime messaging helpers.

-- Realtime broadcasts of row changes (RLS is enforced per subscriber).
alter publication supabase_realtime add table public.messages, public.message_reactions, public.thread_members;

-- Attachments of messages: messages/{school_id}/{thread_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messages', 'messages', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy storage_messages_select on storage.objects for select to authenticated
  using (bucket_id = 'messages' and public.is_thread_member(public.try_uuid((storage.foldername(name))[2]), (select auth.uid())));
create policy storage_messages_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'messages' and public.is_thread_member(public.try_uuid((storage.foldername(name))[2]), (select auth.uid())));
create policy storage_messages_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'messages'
    and (
      owner = (select auth.uid())
      or public.is_thread_moderator(public.try_uuid((storage.foldername(name))[2]), (select auth.uid()))
    )
  );

-- Who may start a direct message with whom (brief §7.4): never parent ↔ parent (unless the
-- school enables it), parents only with the team of their children's classes or the direction.
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
  -- caller is a parent
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
revoke all on function public.can_direct_message(uuid, uuid) from public, anon;
grant execute on function public.can_direct_message(uuid, uuid) to authenticated, service_role;

-- Opens (or reuses) the DM thread between the caller and `other`.
create or replace function public.open_dm(other uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  school uuid;
  thread uuid;
begin
  if not public.can_direct_message(other, me) then
    raise exception 'Conversation non autorisée' using errcode = 'insufficient_privilege';
  end if;
  select t.id into thread
  from public.threads t
  join public.thread_members a on a.thread_id = t.id and a.user_id = me
  join public.thread_members b on b.thread_id = t.id and b.user_id = other
  where t.kind = 'dm'
    and (select count(*) from public.thread_members c where c.thread_id = t.id) = 2
  limit 1;
  if thread is not null then
    return thread;
  end if;
  select m.school_id into school
  from public.memberships m
  where m.user_id = me and m.status = 'active'
    and exists (select 1 from public.memberships t where t.user_id = other and t.school_id = m.school_id and t.status = 'active')
  limit 1;
  insert into public.threads (school_id, kind, created_by) values (school, 'dm', me) returning id into thread;
  insert into public.thread_members (thread_id, user_id, role) values (thread, me, 'member'), (thread, other, 'member');
  return thread;
end
$$;
revoke all on function public.open_dm(uuid) from public, anon;
grant execute on function public.open_dm(uuid) to authenticated, service_role;

-- Creates the official channel + parents group of a class and keeps their members in sync
-- (teachers as moderators, active parents of enrolled students as members). Idempotent.
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

  insert into public.thread_members (thread_id, user_id, role)
  select distinct t.id, sg.user_id, 'member'::public.thread_member_role
  from public.enrollments e
  join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
  join public.memberships m on m.user_id = sg.user_id and m.school_id = school and m.status = 'active' and m.role = 'parent'
  cross join (values (official_id), (group_id)) as t (id)
  where e.class_id = class_ and (e.left_on is null or e.left_on >= current_date)
  on conflict do nothing;

  official := official_id;
  parents_group := group_id;
  return next;
end
$$;
revoke all on function public.ensure_class_threads(uuid) from public, anon;
grant execute on function public.ensure_class_threads(uuid) to authenticated, service_role;

-- The caller's conversations with unread counts and a preview of the last message.
create or replace function public.my_threads()
returns table (
  thread_id uuid, kind public.thread_kind, title text, class_id uuid, class_name text,
  locked boolean, archived boolean, allow_replies boolean, muted boolean, member_role public.thread_member_role,
  last_message_at timestamptz, last_message_preview text, last_author_first_name text,
  unread_count bigint, other_user_id uuid, other_first_name text, other_last_name text
)
language sql stable security definer set search_path = public
as $$
  select
    t.id, t.kind, t.title, t.class_id, c.name,
    t.locked, t.archived, t.allow_replies, tm.muted, tm.role,
    t.last_message_at,
    (select left(m.body, 120) from public.messages m where m.thread_id = t.id and m.deleted_at is null order by m.created_at desc limit 1),
    (select p.first_name from public.messages m join public.profiles p on p.id = m.author_id where m.thread_id = t.id and m.deleted_at is null order by m.created_at desc limit 1),
    (select count(*) from public.messages m
      where m.thread_id = t.id and m.deleted_at is null and m.author_id is distinct from auth.uid()
        and m.created_at > coalesce(tm.last_read_at, tm.joined_at)),
    o.user_id, op.first_name, op.last_name
  from public.thread_members tm
  join public.threads t on t.id = tm.thread_id
  left join public.classes c on c.id = t.class_id
  left join lateral (
    select x.user_id from public.thread_members x where x.thread_id = t.id and x.user_id <> auth.uid() and t.kind = 'dm' limit 1
  ) o on true
  left join public.profiles op on op.id = o.user_id
  where tm.user_id = auth.uid()
  order by t.archived, t.last_message_at desc nulls last, t.created_at desc;
$$;
revoke all on function public.my_threads() from public, anon;
grant execute on function public.my_threads() to authenticated, service_role;

-- Contacts the caller may start a DM with (names only; RLS on profiles still applies elsewhere).
create or replace function public.dm_contacts()
returns table (user_id uuid, first_name text, last_name text, role public.membership_role, class_names text)
language sql stable security definer set search_path = public
as $$
  select distinct on (m.user_id, m.role)
    m.user_id, p.first_name, p.last_name, m.role,
    (select string_agg(c.name, ', ') from public.class_teachers ct join public.classes c on c.id = ct.class_id
       where ct.user_id = m.user_id and not c.archived)
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.status = 'active'
    and m.school_id in (select public.user_school_ids(auth.uid()))
    and m.role in ('school_admin', 'staff', 'teacher', 'parent')
    and m.user_id <> auth.uid()
    and public.can_direct_message(m.user_id, auth.uid())
  order by m.user_id, m.role, p.last_name;
$$;
revoke all on function public.dm_contacts() from public, anon;
grant execute on function public.dm_contacts() to authenticated, service_role;
