-- Session 19, chantier A — the direction's tap on parent → school messaging.
--
-- "Il y a beaucoup trop de messages de parents dans ces structures." The point is
-- not to remove the messaging, it is to give the direction a valve it can open and
-- close at will, and a way to see what is open.
--
-- Three levers, one table:
--   • a school mode in `schools.modules -> 'messaging' ->> 'parentToStaff'`
--     (`open` | `closed` | `scheduled`) with the audiences it applies to;
--   • `messaging_windows`, a dated period that either opens or closes a channel —
--     "ouvrir le mardi 17 h – 19 h" and "fermer du 15 au 30 juin" are the same
--     object with a different `kind`;
--   • a per-thread override a teacher may set on their own channel (ADR-0038).
--
-- Everything is enforced by `can_post_in_thread`, which the `messages_insert`
-- policy already calls: a closed channel refuses the INSERT in the database. The
-- screen only explains what the database would refuse anyway.

-- ── types ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'messaging_scope') then
    create type public.messaging_scope as enum ('teachers', 'staff', 'direction', 'all');
  end if;
  if not exists (select 1 from pg_type where typname = 'messaging_window_kind') then
    create type public.messaging_window_kind as enum ('open', 'closed');
  end if;
end $$;

-- ── the windows ──────────────────────────────────────────────────────────────
create table if not exists public.messaging_windows (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  scope public.messaging_scope not null default 'teachers',
  kind public.messaging_window_kind not null default 'open',
  -- optional narrowing: one class, or one member of the team
  class_id uuid references public.classes (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete cascade,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index if not exists messaging_windows_school_idx
  on public.messaging_windows (school_id, opens_at desc);
create index if not exists messaging_windows_active_idx
  on public.messaging_windows (school_id, closes_at) where kind = 'closed';
create index if not exists messaging_windows_class_idx on public.messaging_windows (class_id);
create index if not exists messaging_windows_target_idx on public.messaging_windows (target_user_id);
-- Mirrors the profile foreign keys of 20260908171000 so the Data API can embed
-- the member a period names: `select('*, target:profiles(...)')`.
alter table public.messaging_windows drop constraint if exists messaging_windows_target_profile_fkey;
alter table public.messaging_windows add constraint messaging_windows_target_profile_fkey
  foreign key (target_user_id) references public.profiles (id) on delete cascade;
alter table public.messaging_windows drop constraint if exists messaging_windows_created_by_profile_fkey;
alter table public.messaging_windows add constraint messaging_windows_created_by_profile_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

drop trigger if exists messaging_windows_set_updated_at on public.messaging_windows;
create trigger messaging_windows_set_updated_at before update on public.messaging_windows
  for each row execute function public.set_updated_at();

alter table public.messaging_windows enable row level security;
-- The team reads the calendar of its own school; the direction alone writes it.
drop policy if exists messaging_windows_select on public.messaging_windows;
create policy messaging_windows_select on public.messaging_windows for select to authenticated
  using (
    public.is_school_staff(school_id, (select auth.uid()))
    or public.has_school_role(school_id, array['teacher']::public.membership_role[], (select auth.uid()))
  );
drop policy if exists messaging_windows_insert on public.messaging_windows;
create policy messaging_windows_insert on public.messaging_windows for insert to authenticated
  with check (
    public.is_school_admin(school_id, (select auth.uid()))
    and created_by = (select auth.uid())
    and (class_id is null or exists (
      select 1 from public.classes c where c.id = class_id and c.school_id = messaging_windows.school_id))
    and (target_user_id is null or public.is_school_member(school_id, target_user_id))
  );
drop policy if exists messaging_windows_update on public.messaging_windows;
create policy messaging_windows_update on public.messaging_windows for update to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())))
  with check (public.is_school_admin(school_id, (select auth.uid())));
drop policy if exists messaging_windows_delete on public.messaging_windows;
create policy messaging_windows_delete on public.messaging_windows for delete to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())));

-- The school-wide switch cannot be rewritten by the people it constrains: only
-- the direction may touch `modules`, and `schools_update` already says so.

-- ── is the channel open, here, now? ──────────────────────────────────────────
-- `class_` and `target_` narrow the question: a window bound to a class does not
-- open a direct message, and a window bound to one teacher leaves the others as
-- they were.
create or replace function public.messaging_is_open(
  school_ uuid,
  scope_ public.messaging_scope,
  class_ uuid default null,
  target_ uuid default null,
  at_ timestamptz default now()
)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  mode text;
  scopes text[];
begin
  select coalesce(s.modules -> 'messaging' ->> 'parentToStaff', 'open'),
         coalesce(
           (select array_agg(value) from jsonb_array_elements_text(
              case jsonb_typeof(s.modules -> 'messaging' -> 'closedScopes')
                when 'array' then s.modules -> 'messaging' -> 'closedScopes'
                else '[]'::jsonb
              end)),
           array['teachers'])
    into mode, scopes
  from public.schools s where s.id = school_;
  if mode is null then
    return true; -- unknown school: nothing of ours to close
  end if;

  -- A closing period always wins, whatever the mode.
  if exists (
    select 1 from public.messaging_windows w
    where w.school_id = school_ and w.kind = 'closed'
      and at_ >= w.opens_at and at_ < w.closes_at
      and (w.scope = 'all' or w.scope = scope_)
      and (w.class_id is null or w.class_id = class_)
      and (w.target_user_id is null or w.target_user_id = target_)
  ) then
    return false;
  end if;

  if mode = 'open' then
    return true;
  end if;
  -- `closed` and `scheduled` only bite on the audiences the direction picked.
  if not (scope_::text = any (scopes) or 'all' = any (scopes)) then
    return true;
  end if;
  if mode <> 'scheduled' then
    return false;
  end if;
  return exists (
    select 1 from public.messaging_windows w
    where w.school_id = school_ and w.kind = 'open'
      and at_ >= w.opens_at and at_ < w.closes_at
      and (w.scope = 'all' or w.scope = scope_)
      and (w.class_id is null or w.class_id = class_)
      and (w.target_user_id is null or w.target_user_id = target_)
  );
end
$$;
revoke all on function public.messaging_is_open(uuid, public.messaging_scope, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.messaging_is_open(uuid, public.messaging_scope, uuid, uuid, timestamptz) to authenticated, service_role;

-- When does it open again? Only what is actually written down (arbitrage 4): a
-- date is a promise, and we only make the ones the direction has entered.
create or replace function public.messaging_next_opening(
  school_ uuid,
  scope_ public.messaging_scope,
  class_ uuid default null,
  target_ uuid default null,
  at_ timestamptz default now()
)
returns timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  mode text;
begin
  if public.messaging_is_open(school_, scope_, class_, target_, at_) then
    return null;
  end if;
  select coalesce(s.modules -> 'messaging' ->> 'parentToStaff', 'open')
    into mode from public.schools s where s.id = school_;

  if mode = 'scheduled' then
    return (
      select min(w.opens_at) from public.messaging_windows w
      where w.school_id = school_ and w.kind = 'open' and w.opens_at > at_
        and (w.scope = 'all' or w.scope = scope_)
        and (w.class_id is null or w.class_id = class_)
        and (w.target_user_id is null or w.target_user_id = target_)
    );
  end if;
  if mode = 'open' then
    -- Closed by a period alone: it ends on its own.
    return (
      select max(w.closes_at) from public.messaging_windows w
      where w.school_id = school_ and w.kind = 'closed'
        and at_ >= w.opens_at and at_ < w.closes_at
        and (w.scope = 'all' or w.scope = scope_)
        and (w.class_id is null or w.class_id = class_)
        and (w.target_user_id is null or w.target_user_id = target_)
    );
  end if;
  return null; -- mode `closed`: no reopening was announced, so none is shown
end
$$;
revoke all on function public.messaging_next_opening(uuid, public.messaging_scope, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.messaging_next_opening(uuid, public.messaging_scope, uuid, uuid, timestamptz) to authenticated, service_role;

-- The end of the opening period a channel is currently inside, when there is one.
-- "Heures de réponse" used to be a static sentence promising 48 working hours
-- that nothing in the code applied. Either it is true or it goes; this is the
-- version the database can vouch for.
create or replace function public.messaging_current_closing(
  school_ uuid,
  scope_ public.messaging_scope,
  class_ uuid default null,
  target_ uuid default null,
  at_ timestamptz default now()
)
returns timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  mode text;
begin
  select coalesce(s.modules -> 'messaging' ->> 'parentToStaff', 'open')
    into mode from public.schools s where s.id = school_;
  if mode <> 'scheduled' then
    return null;
  end if;
  if not public.messaging_is_open(school_, scope_, class_, target_, at_) then
    return null;
  end if;
  return (
    select min(w.closes_at) from public.messaging_windows w
    where w.school_id = school_ and w.kind = 'open'
      and at_ >= w.opens_at and at_ < w.closes_at
      and (w.scope = 'all' or w.scope = scope_)
      and (w.class_id is null or w.class_id = class_)
      and (w.target_user_id is null or w.target_user_id = target_)
  );
end
$$;
revoke all on function public.messaging_current_closing(uuid, public.messaging_scope, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.messaging_current_closing(uuid, public.messaging_scope, uuid, uuid, timestamptz) to authenticated, service_role;

-- ── the state of one conversation, from a parent's side ──────────────────────
-- A class thread is a channel to its teachers. A direct message or a group is a
-- channel to whoever is on the other side; the most open counterpart decides.
-- A conversation with no member of the team on the other side (parent ↔ parent)
-- is not this valve's business.
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

create or replace function public.parent_channel_open(thread_ uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((public.thread_messaging_state(thread_, uid) ->> 'open')::boolean, false);
$$;
revoke all on function public.parent_channel_open(uuid, uuid) from public, anon;
grant execute on function public.parent_channel_open(uuid, uuid) to authenticated, service_role;

-- ── the valve, applied ───────────────────────────────────────────────────────
-- Only the parent branch is gated: the team keeps writing while the channel is
-- shut, which is the whole point — the direction still reaches the families.
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
        or (public.parent_can_message(uid, t.class_id) and public.parent_channel_open(t.id, uid))
      )
  );
$$;

-- Opening a new conversation obeys the same valve, otherwise a closed channel
-- would only be one "new message" away.
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

-- ── the load that justifies closing ──────────────────────────────────────────
-- Without a number, the direction closes blind. One row per week and per
-- channel: a class, a teacher reached directly, or the office (both null).
create or replace function public.messaging_load(school_ uuid, weeks integer default 8)
returns table (week_start date, class_id uuid, teacher_id uuid, messages bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_school_admin(school_) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
  with parents as (
    select distinct m.user_id
    from public.memberships m
    where m.school_id = school_ and m.status = 'active' and m.role = 'parent'
      and not exists (
        select 1 from public.memberships x
        where x.user_id = m.user_id and x.school_id = school_ and x.status = 'active'
          and x.role in ('school_admin', 'staff', 'teacher', 'super_admin')
      )
  ),
  sent as (
    select
      (date_trunc('week', msg.created_at))::date as wk,
      t.class_id as cls,
      case when t.class_id is null then (
        select tm.user_id from public.thread_members tm
        join public.memberships mm on mm.user_id = tm.user_id and mm.school_id = school_
          and mm.status = 'active' and mm.role = 'teacher'
        where tm.thread_id = t.id and tm.user_id <> msg.author_id
        order by tm.user_id limit 1
      ) end as tch
    from public.messages msg
    join public.threads t on t.id = msg.thread_id
    where t.school_id = school_
      and msg.author_id in (select user_id from parents)
      and msg.created_at >= date_trunc('week', now())
        - make_interval(weeks => greatest(coalesce(weeks, 8), 1) - 1)
  )
  select s.wk, s.cls, s.tch, count(*)
  from sent s
  group by s.wk, s.cls, s.tch
  order by s.wk desc;
end
$$;
revoke all on function public.messaging_load(uuid, integer) from public, anon;
grant execute on function public.messaging_load(uuid, integer) to authenticated, service_role;

-- ── retention ────────────────────────────────────────────────────────────────
-- Periods that closed more than a year ago say nothing anyone still needs.
create or replace function public.purge_messaging_windows()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  delete from public.messaging_windows where closes_at < now() - interval '1 year';
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.purge_messaging_windows() from public, anon, authenticated;
grant execute on function public.purge_messaging_windows() to service_role;

-- ── writing the school switch ────────────────────────────────────────────────
-- `modules -> 'messaging'` was a bare `true` in the seed. Anything that is not an
-- object is replaced by one, so the older flag never blocks the new setting.
create or replace function public.set_messaging_mode(
  school_ uuid,
  mode_ text,
  scopes_ text[] default array['teachers'],
  urgency_ text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  current_modules jsonb;
  messaging jsonb;
  clean_scopes text[];
  clean_urgency text := nullif(btrim(coalesce(urgency_, '')), '');
begin
  if not public.is_school_admin(school_) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if mode_ not in ('open', 'closed', 'scheduled') then
    raise exception 'Mode invalide' using errcode = 'check_violation';
  end if;
  select array_agg(distinct s) into clean_scopes
  from unnest(coalesce(scopes_, array['teachers'])) as s
  where s in ('teachers', 'staff', 'direction', 'all');
  if clean_scopes is null or array_length(clean_scopes, 1) = 0 then
    clean_scopes := array['teachers'];
  end if;
  if clean_urgency is not null and char_length(clean_urgency) > 200 then
    raise exception 'Contact trop long' using errcode = 'check_violation';
  end if;

  select modules into current_modules from public.schools where id = school_;
  if current_modules is null then
    raise exception 'École introuvable' using errcode = 'no_data_found';
  end if;
  messaging := case jsonb_typeof(current_modules -> 'messaging')
                 when 'object' then current_modules -> 'messaging'
                 else '{}'::jsonb
               end;
  messaging := messaging
    || jsonb_build_object('parentToStaff', mode_)
    || jsonb_build_object('closedScopes', to_jsonb(clean_scopes))
    || jsonb_build_object('urgencyContact', to_jsonb(clean_urgency));

  update public.schools
  set modules = current_modules || jsonb_build_object('messaging', messaging)
  where id = school_;

  perform public.log_audit(school_, 'messaging.mode', 'schools', school_, messaging);
  return messaging;
end
$$;
revoke all on function public.set_messaging_mode(uuid, text, text[], text) from public, anon;
grant execute on function public.set_messaging_mode(uuid, text, text[], text) to authenticated, service_role;

-- ── a teacher's hand on their own channel ────────────────────────────────────
-- `allow_replies` existed since the first migration and was exposed nowhere. It
-- becomes a readable switch: "Les familles peuvent répondre" / "Annonce seule".
-- `overrideSchoolClosure` is the teacher reopening despite a school-wide closure
-- (arbitrage 3): allowed, traced, and shown to the direction.
create or replace function public.set_thread_replies(
  thread_ uuid,
  allow_ boolean default null,
  override_ boolean default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  t record;
begin
  select id, school_id, settings into t from public.threads where id = thread_;
  if not found then
    raise exception 'Fil introuvable' using errcode = 'no_data_found';
  end if;
  if not (public.is_thread_moderator(thread_) or public.is_school_admin(t.school_id)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if allow_ is not null then
    update public.threads set allow_replies = allow_ where id = thread_;
    perform public.log_audit(t.school_id, 'thread.replies', 'threads', thread_,
      jsonb_build_object('allow_replies', allow_));
  end if;
  if override_ is not null then
    update public.threads
    set settings = case
                     when override_ then coalesce(settings, '{}'::jsonb) || jsonb_build_object('overrideSchoolClosure', true)
                     else coalesce(settings, '{}'::jsonb) - 'overrideSchoolClosure'
                   end
    where id = thread_;
    perform public.log_audit(t.school_id, 'thread.override', 'threads', thread_,
      jsonb_build_object('overrideSchoolClosure', override_));
  end if;
end
$$;
revoke all on function public.set_thread_replies(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_thread_replies(uuid, boolean, boolean) to authenticated, service_role;

-- ── the channels the direction pilots ────────────────────────────────────────
-- One row per class channel, with its state and whether a teacher reopened it.
create or replace function public.messaging_channels(school_ uuid)
returns table (
  thread_id uuid, kind public.thread_kind, class_id uuid, class_name text,
  allow_replies boolean, locked boolean, archived boolean,
  override boolean, is_open boolean, reopens_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_school_admin(school_) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
  select t.id, t.kind, t.class_id, c.name,
         t.allow_replies, t.locked, t.archived,
         coalesce((t.settings ->> 'overrideSchoolClosure')::boolean, false),
         public.messaging_is_open(school_, 'teachers', t.class_id),
         public.messaging_next_opening(school_, 'teachers', t.class_id)
  from public.threads t
  join public.classes c on c.id = t.class_id
  where t.school_id = school_ and t.kind in ('class_official', 'class_group') and not t.archived
  order by c.name, t.kind;
end
$$;
revoke all on function public.messaging_channels(uuid) from public, anon;
grant execute on function public.messaging_channels(uuid) to authenticated, service_role;
