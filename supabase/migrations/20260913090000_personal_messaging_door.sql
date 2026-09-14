-- Session 29 — the person's own door (ADR-0060).
--
-- Session 19 gave the *direction* a tap on parent → school messaging: a school
-- mode, dated windows, a per-thread override. What it never gave anyone was a
-- door of their own. A teacher reviewing the application put it plainly: she
-- wants to refuse direct messages from families without ever cutting herself
-- off from her colleagues — and the same is true of the secretariat and of the
-- direction.
--
-- One boolean on the profile, and two functions that already exist read it:
--   • `can_direct_message` — only in its parent branch, so a colleague opening
--     a conversation is never refused;
--   • `thread_messaging_state` — for a direct message already open, so a closed
--     door stops the next message rather than only the first.
-- Class threads (`class_official`, `class_group`) are untouched: the door is
-- about being written to personally, not about the channel where the school
-- speaks to a whole class.

alter table public.profiles
  add column if not exists accepts_parent_dm boolean not null default true;

comment on column public.profiles.accepts_parent_dm is
  'Team members only: false refuses direct messages coming from families. Never applies between colleagues.';

-- ── the door, read from anywhere ─────────────────────────────────────────────
create or replace function public.accepts_parent_dm(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select p.accepts_parent_dm from public.profiles p where p.id = target), true);
$$;
revoke all on function public.accepts_parent_dm(uuid) from public, anon;
grant execute on function public.accepts_parent_dm(uuid) to authenticated, service_role;

-- ── opening a conversation ───────────────────────────────────────────────────
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
  -- ...and the person written to must have left their own door open (ADR-0060)
  if not public.accepts_parent_dm(target) then
    return false;
  end if;
  if target_roles && array['school_admin', 'super_admin']::public.membership_role[]
     and public.messaging_is_open(school, 'direction', null, target) then
    return true;
  end if;
  if 'staff' = any (target_roles)
     and public.messaging_is_open(school, 'staff', null, target) then
    return true;
  end if;
  if 'teacher' = any (target_roles) then
    return public.messaging_is_open(school, 'teachers', null, target)
      and exists (
        select 1 from public.class_teachers ct
        where ct.user_id = target and ct.class_id in (select public.guardian_class_ids(uid))
      );
  end if;
  if target_roles && array['school_admin', 'staff', 'super_admin']::public.membership_role[] then
    return false; -- reachable in principle, but their channel is shut
  end if;
  select coalesce((s.modules -> 'messaging' ->> 'parentToParent')::boolean, false) into parent_to_parent
  from public.schools s where s.id = school;
  return parent_to_parent and (target_roles && array['parent']::public.membership_role[]);
end
$$;
revoke all on function public.can_direct_message(uuid, uuid) from public, anon;
grant execute on function public.can_direct_message(uuid, uuid) to authenticated, service_role;

-- ── writing in a conversation already open ───────────────────────────────────
-- `closedBy: 'person'` lets the screen say the true reason: this is not the
-- school's tap, and there is no reopening date to promise.
create or replace function public.thread_messaging_state(thread_ uuid, uid uuid default auth.uid())
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  t record;
  r record;
  has_team boolean := false;
  reopens timestamptz;
  candidate timestamptz;
  caller_is_team boolean;
begin
  select id, school_id, kind, class_id, settings into t
  from public.threads where id = thread_;
  if not found then
    return jsonb_build_object('open', false, 'reopensAt', null, 'governed', false);
  end if;

  -- A teacher who reopened their own channel (ADR-0038) — audited, and visible
  -- to the direction on the pilot screen.
  if coalesce((t.settings ->> 'overrideSchoolClosure')::boolean, false) then
    return jsonb_build_object('open', true, 'reopensAt', null, 'governed', true, 'override', true);
  end if;

  if t.kind in ('class_official', 'class_group') then
    if public.messaging_is_open(t.school_id, 'teachers', t.class_id) then
      return jsonb_build_object('open', true, 'reopensAt', null, 'governed', true,
        'closesAt', public.messaging_current_closing(t.school_id, 'teachers', t.class_id));
    end if;
    return jsonb_build_object(
      'open', false,
      'reopensAt', public.messaging_next_opening(t.school_id, 'teachers', t.class_id),
      'governed', true);
  end if;

  caller_is_team := public.is_school_staff(t.school_id, uid)
    or public.has_school_role(t.school_id, array['teacher']::public.membership_role[], uid);

  -- The person's own door: a family writing to someone who has closed it is
  -- stopped here; a colleague never is.
  if not caller_is_team and exists (
    select 1
    from public.thread_members tm
    join public.memberships m
      on m.user_id = tm.user_id and m.school_id = t.school_id and m.status = 'active'
    where tm.thread_id = thread_ and tm.user_id <> uid
      and m.role in ('school_admin', 'super_admin', 'staff', 'teacher')
      and not public.accepts_parent_dm(tm.user_id)
  ) then
    return jsonb_build_object('open', false, 'reopensAt', null, 'governed', true,
      'closedBy', 'person');
  end if;

  for r in
    select tm.user_id,
           bool_or(m.role in ('school_admin', 'super_admin')) as is_admin,
           bool_or(m.role = 'staff') as is_staff,
           bool_or(m.role = 'teacher') as is_teacher
    from public.thread_members tm
    join public.memberships m
      on m.user_id = tm.user_id and m.school_id = t.school_id and m.status = 'active'
    where tm.thread_id = thread_ and tm.user_id <> uid
    group by tm.user_id
  loop
    if r.is_admin then
      has_team := true;
      if public.messaging_is_open(t.school_id, 'direction', null, r.user_id) then
        return jsonb_build_object('open', true, 'reopensAt', null, 'governed', true,
          'closesAt', public.messaging_current_closing(t.school_id, 'direction', null, r.user_id));
      end if;
      candidate := public.messaging_next_opening(t.school_id, 'direction', null, r.user_id);
      reopens := least(coalesce(reopens, candidate), coalesce(candidate, reopens));
    end if;
    if r.is_staff then
      has_team := true;
      if public.messaging_is_open(t.school_id, 'staff', null, r.user_id) then
        return jsonb_build_object('open', true, 'reopensAt', null, 'governed', true,
          'closesAt', public.messaging_current_closing(t.school_id, 'staff', null, r.user_id));
      end if;
      candidate := public.messaging_next_opening(t.school_id, 'staff', null, r.user_id);
      reopens := least(coalesce(reopens, candidate), coalesce(candidate, reopens));
    end if;
    if r.is_teacher then
      has_team := true;
      if public.messaging_is_open(t.school_id, 'teachers', null, r.user_id) then
        return jsonb_build_object('open', true, 'reopensAt', null, 'governed', true,
          'closesAt', public.messaging_current_closing(t.school_id, 'teachers', null, r.user_id));
      end if;
      candidate := public.messaging_next_opening(t.school_id, 'teachers', null, r.user_id);
      reopens := least(coalesce(reopens, candidate), coalesce(candidate, reopens));
    end if;
  end loop;

  if not has_team then
    return jsonb_build_object('open', true, 'reopensAt', null, 'governed', false);
  end if;
  return jsonb_build_object('open', false, 'reopensAt', reopens, 'governed', true);
end
$$;
revoke all on function public.thread_messaging_state(uuid, uuid) from public, anon;
grant execute on function public.thread_messaging_state(uuid, uuid) to authenticated, service_role;
