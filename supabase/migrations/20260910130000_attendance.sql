-- Session 19, chantier B — la pointeuse.
--
-- The brief filed "cantine et garderie" under MVP non-objectives; the direction
-- reopens that door deliberately (ADR-0039). What this registers: presence, an
-- arrival, a departure, and who collects the child. What it does not: billing.
-- The model can feed a billing system later without a painful migration —
-- a service `code` on the list, a date on the session, arrival and departure
-- timestamps on the record — but nothing here prices anything.

-- ── types ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_list_kind') then
    create type public.attendance_list_kind as enum ('class_roll', 'service', 'occasional');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
  end if;
end $$;

-- ── the lists ────────────────────────────────────────────────────────────────
create table if not exists public.attendance_lists (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.attendance_list_kind not null,
  name text not null check (char_length(name) between 1 and 120),
  -- A service identity a future billing run can group on. Never priced here.
  code text check (code is null or code ~ '^[a-z0-9_-]{2,40}$'),
  -- `class_id` is the class the list belongs to (a roll call, an outing of one
  -- class). `class_ids` narrows a service to a few classes; empty means the
  -- whole school, which is what "périscolaire du soir" actually is.
  class_id uuid references public.classes (id) on delete cascade,
  class_ids uuid[] not null default '{}',
  event_id uuid references public.events (id) on delete cascade,
  -- Recurrence, deliberately small: ISO weekdays (1 = Monday) over a date range.
  weekdays smallint[] not null default '{}',
  starts_on date,
  ends_on date,
  opens_at time,
  closes_at time,
  -- Arbitrage 6: who collects the child is asked at the after-school club and on
  -- outings, not at the classroom roll call, where one tap per child is what
  -- makes the thing usable at all.
  records_pickup boolean not null default true,
  -- Arbitrage 5: families follow the after-school club and outings live; the
  -- classroom roll call stays inside the team.
  visible_to_guardians boolean not null default true,
  archived boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'class_roll' or class_id is not null),
  check (kind <> 'occasional' or (class_id is not null or event_id is not null)),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create index if not exists attendance_lists_school_idx
  on public.attendance_lists (school_id) where not archived;
create index if not exists attendance_lists_class_idx on public.attendance_lists (class_id);
create index if not exists attendance_lists_event_idx on public.attendance_lists (event_id);
create unique index if not exists attendance_lists_event_unique_idx
  on public.attendance_lists (event_id) where event_id is not null and not archived;
drop trigger if exists attendance_lists_set_updated_at on public.attendance_lists;
create trigger attendance_lists_set_updated_at before update on public.attendance_lists
  for each row execute function public.set_updated_at();

-- Who may point on this list. No new role: `staff`, `school_admin` and
-- `teacher` as they are, but the right is granted list by list so that an
-- evening supervisor does not inherit the secretariat's reach.
create table if not exists public.attendance_list_managers (
  list_id uuid not null references public.attendance_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index if not exists attendance_list_managers_user_idx
  on public.attendance_list_managers (user_id);
alter table public.attendance_list_managers drop constraint if exists attendance_list_managers_user_profile_fkey;
alter table public.attendance_list_managers add constraint attendance_list_managers_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- ── one dated occurrence of a list ───────────────────────────────────────────
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  list_id uuid not null references public.attendance_lists (id) on delete cascade,
  on_date date not null,
  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (list_id, on_date)
);
create index if not exists attendance_sessions_school_date_idx
  on public.attendance_sessions (school_id, on_date desc);
create index if not exists attendance_sessions_list_idx
  on public.attendance_sessions (list_id, on_date desc);

-- ── one child in one occurrence ──────────────────────────────────────────────
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attendance_status not null default 'present',
  arrived_at timestamptz,
  departed_at timestamptz,
  marked_by uuid references auth.users (id) on delete set null,
  -- Only an authorised guardian of THIS child; a judicial restriction is refused
  -- by `attendance_pickup_guard` below. This is the safety point of the feature.
  pickup_user_id uuid references auth.users (id) on delete set null,
  pickup_note text check (pickup_note is null or char_length(pickup_note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id),
  check (departed_at is null or arrived_at is null or departed_at >= arrived_at)
);
create index if not exists attendance_records_session_idx
  on public.attendance_records (session_id);
create index if not exists attendance_records_student_idx
  on public.attendance_records (student_id, created_at desc);
create index if not exists attendance_records_pickup_idx
  on public.attendance_records (pickup_user_id);
alter table public.attendance_records drop constraint if exists attendance_records_pickup_profile_fkey;
alter table public.attendance_records add constraint attendance_records_pickup_profile_fkey
  foreign key (pickup_user_id) references public.profiles (id) on delete set null;
alter table public.attendance_records drop constraint if exists attendance_records_marked_by_profile_fkey;
alter table public.attendance_records add constraint attendance_records_marked_by_profile_fkey
  foreign key (marked_by) references public.profiles (id) on delete set null;
drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ── the school's clock ───────────────────────────────────────────────────────
-- "Today" is the school's day, not the server's: a session opened at 00:30 in
-- Paris must not land on the previous date.
create or replace function public.school_timezone(school_ uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((select s.timezone from public.schools s where s.id = school_), 'Europe/Paris');
$$;
revoke all on function public.school_timezone(uuid) from public, anon;
grant execute on function public.school_timezone(uuid) to authenticated, service_role;

-- ── the roster ───────────────────────────────────────────────────────────────
-- Who is expected on a list: the class it belongs to, the classes it names, or
-- the whole school.
create or replace function public.attendance_list_students(list_ uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select s.id
  from public.attendance_lists l
  join public.students s on s.school_id = l.school_id
    and s.status = 'active' and s.deleted_at is null
  where l.id = list_
    and (
      case
        when l.class_id is not null then exists (
          select 1 from public.enrollments e
          where e.student_id = s.id and e.class_id = l.class_id and e.left_on is null)
        when coalesce(array_length(l.class_ids, 1), 0) > 0 then exists (
          select 1 from public.enrollments e
          where e.student_id = s.id and e.class_id = any (l.class_ids) and e.left_on is null)
        else exists (
          select 1 from public.enrollments e where e.student_id = s.id and e.left_on is null)
      end
    );
$$;
revoke all on function public.attendance_list_students(uuid) from public, anon;
grant execute on function public.attendance_list_students(uuid) to authenticated, service_role;

create or replace function public.attendance_student_on_list(session_ uuid, student_ uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.attendance_sessions s
    where s.id = session_ and student_ in (select public.attendance_list_students(s.list_id))
  );
$$;
revoke all on function public.attendance_student_on_list(uuid, uuid) from public, anon;
grant execute on function public.attendance_student_on_list(uuid, uuid) to authenticated, service_role;

-- ── who may do what ──────────────────────────────────────────────────────────
create or replace function public.attendance_can_manage(list_ uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.attendance_lists l
    where l.id = list_
      and (
        public.is_school_admin(l.school_id, uid)
        or exists (
          select 1 from public.attendance_list_managers m
          where m.list_id = l.id and m.user_id = uid
        )
        -- the roll call of a class belongs to the people who teach it
        or (l.class_id is not null and public.is_class_teacher(l.class_id, uid))
      )
  );
$$;
revoke all on function public.attendance_can_manage(uuid, uuid) from public, anon;
grant execute on function public.attendance_can_manage(uuid, uuid) to authenticated, service_role;

-- A guardian follows their own child, and only on the lists the direction opened
-- to families (arbitrage 5).
create or replace function public.attendance_can_view_record(record_ uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.attendance_records r
    join public.attendance_sessions s on s.id = r.session_id
    join public.attendance_lists l on l.id = s.list_id
    where r.id = record_
      and (
        public.attendance_can_manage(l.id, uid)
        or public.is_school_staff(l.school_id, uid)
        or (l.visible_to_guardians and public.can_access_student(r.student_id, uid))
      )
  );
$$;
revoke all on function public.attendance_can_view_record(uuid, uuid) from public, anon;
grant execute on function public.attendance_can_view_record(uuid, uuid) to authenticated, service_role;

-- The safety point: a person collecting a child must be one of that child's
-- authorised guardians, and a judicial restriction closes the door entirely.
create or replace function public.attendance_pickup_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.pickup_user_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.student_guardians sg
    where sg.student_id = new.student_id
      and sg.user_id = new.pickup_user_id
      and not sg.access_blocked
  ) then
    raise exception 'Cette personne n''est pas autorisée à récupérer cet enfant'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
drop trigger if exists attendance_records_pickup_guard on public.attendance_records;
create trigger attendance_records_pickup_guard
  before insert or update of pickup_user_id, student_id on public.attendance_records
  for each row execute function public.attendance_pickup_guard();

-- ── row level security ───────────────────────────────────────────────────────
alter table public.attendance_lists enable row level security;
drop policy if exists attendance_lists_select on public.attendance_lists;
create policy attendance_lists_select on public.attendance_lists for select to authenticated
  using (
    public.attendance_can_manage(id, (select auth.uid()))
    or public.is_school_staff(school_id, (select auth.uid()))
    -- a guardian sees the list only through their child's records, but needs its
    -- name to read them: visible lists of their school are enough
    or (visible_to_guardians and public.is_school_member(school_id, (select auth.uid())))
  );
drop policy if exists attendance_lists_insert on public.attendance_lists;
create policy attendance_lists_insert on public.attendance_lists for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.is_school_admin(school_id, (select auth.uid()))
      or (class_id is not null and public.is_class_teacher(class_id, (select auth.uid())))
    )
    and (class_id is null or exists (
      select 1 from public.classes c where c.id = class_id and c.school_id = attendance_lists.school_id))
    and (event_id is null or exists (
      select 1 from public.events e where e.id = event_id and e.school_id = attendance_lists.school_id))
  );
drop policy if exists attendance_lists_update on public.attendance_lists;
create policy attendance_lists_update on public.attendance_lists for update to authenticated
  using (public.is_school_admin(school_id, (select auth.uid()))
         or (class_id is not null and public.is_class_teacher(class_id, (select auth.uid()))))
  with check (public.is_school_admin(school_id, (select auth.uid()))
              or (class_id is not null and public.is_class_teacher(class_id, (select auth.uid()))));
drop policy if exists attendance_lists_delete on public.attendance_lists;
create policy attendance_lists_delete on public.attendance_lists for delete to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())));

alter table public.attendance_list_managers enable row level security;
drop policy if exists attendance_list_managers_select on public.attendance_list_managers;
create policy attendance_list_managers_select on public.attendance_list_managers for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.attendance_lists l
      where l.id = list_id and public.is_school_staff(l.school_id, (select auth.uid()))
    )
  );
drop policy if exists attendance_list_managers_write on public.attendance_list_managers;
create policy attendance_list_managers_write on public.attendance_list_managers for all to authenticated
  using (exists (
    select 1 from public.attendance_lists l
    where l.id = list_id and public.is_school_admin(l.school_id, (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.attendance_lists l
    where l.id = list_id and public.is_school_admin(l.school_id, (select auth.uid()))
      and public.is_school_member(l.school_id, attendance_list_managers.user_id)
  ));

alter table public.attendance_sessions enable row level security;
drop policy if exists attendance_sessions_select on public.attendance_sessions;
create policy attendance_sessions_select on public.attendance_sessions for select to authenticated
  using (
    public.attendance_can_manage(list_id, (select auth.uid()))
    or public.is_school_staff(school_id, (select auth.uid()))
    or exists (
      select 1 from public.attendance_lists l
      where l.id = list_id and l.visible_to_guardians
        and public.is_school_member(school_id, (select auth.uid()))
    )
  );
drop policy if exists attendance_sessions_insert on public.attendance_sessions;
create policy attendance_sessions_insert on public.attendance_sessions for insert to authenticated
  with check (
    public.attendance_can_manage(list_id, (select auth.uid()))
    and opened_by = (select auth.uid())
    and exists (select 1 from public.attendance_lists l
                where l.id = list_id and l.school_id = attendance_sessions.school_id and not l.archived)
  );
drop policy if exists attendance_sessions_update on public.attendance_sessions;
create policy attendance_sessions_update on public.attendance_sessions for update to authenticated
  using (public.attendance_can_manage(list_id, (select auth.uid())))
  with check (public.attendance_can_manage(list_id, (select auth.uid())));
drop policy if exists attendance_sessions_delete on public.attendance_sessions;
create policy attendance_sessions_delete on public.attendance_sessions for delete to authenticated
  using (public.is_school_admin(school_id, (select auth.uid())));

alter table public.attendance_records enable row level security;
drop policy if exists attendance_records_select on public.attendance_records;
create policy attendance_records_select on public.attendance_records for select to authenticated
  using (public.attendance_can_view_record(id, (select auth.uid())));
drop policy if exists attendance_records_insert on public.attendance_records;
create policy attendance_records_insert on public.attendance_records for insert to authenticated
  with check (
    marked_by = (select auth.uid())
    and exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id and s.school_id = attendance_records.school_id
        and s.closed_at is null
        and public.attendance_can_manage(s.list_id, (select auth.uid()))
    )
    -- the child must actually be on this list
    and public.attendance_student_on_list(session_id, student_id)
  );
drop policy if exists attendance_records_update on public.attendance_records;
create policy attendance_records_update on public.attendance_records for update to authenticated
  using (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.attendance_can_manage(s.list_id, (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.attendance_can_manage(s.list_id, (select auth.uid()))
  ));
drop policy if exists attendance_records_delete on public.attendance_records;
create policy attendance_records_delete on public.attendance_records for delete to authenticated
  using (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.is_school_admin(s.school_id, (select auth.uid()))
  ));

-- ── the gestures, as one call each ───────────────────────────────────────────
-- The screen does one thing per tap and the offline queue replays exactly these
-- calls, so the rules live here rather than in three round trips.

/** Opens (or finds) the occurrence of a list for a date. */
create or replace function public.open_attendance_session(list_ uuid, on_date_ date default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  l record;
  day_ date;
  existing uuid;
  created uuid;
begin
  select id, school_id, weekdays, starts_on, ends_on, archived into l
  from public.attendance_lists where id = list_;
  if not found or l.archived then
    raise exception 'Liste introuvable' using errcode = 'no_data_found';
  end if;
  if not public.attendance_can_manage(list_) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  day_ := coalesce(on_date_, (now() at time zone public.school_timezone(l.school_id))::date);

  select id into existing from public.attendance_sessions
  where list_id = list_ and on_date = day_;
  if existing is not null then
    return existing;
  end if;

  insert into public.attendance_sessions (school_id, list_id, on_date, opened_by)
  values (l.school_id, list_, day_, auth.uid())
  returning id into created;
  return created;
end
$$;
revoke all on function public.open_attendance_session(uuid, date) from public, anon;
grant execute on function public.open_attendance_session(uuid, date) to authenticated, service_role;

/** Closes an occurrence: nothing more is pointed on it, corrections stay possible. */
create or replace function public.close_attendance_session(session_ uuid, reopen boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s record;
begin
  select id, school_id, list_id into s from public.attendance_sessions where id = session_;
  if not found then
    raise exception 'Pointage introuvable' using errcode = 'no_data_found';
  end if;
  if not public.attendance_can_manage(s.list_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  update public.attendance_sessions
  set closed_at = case when reopen then null else now() end,
      closed_by = case when reopen then null else auth.uid() end
  where id = session_;
  perform public.log_audit(s.school_id, case when reopen then 'attendance.reopen' else 'attendance.close' end,
    'attendance_sessions', session_, null);
end
$$;
revoke all on function public.close_attendance_session(uuid, boolean) from public, anon;
grant execute on function public.close_attendance_session(uuid, boolean) to authenticated, service_role;

/**
 * One tap. `status` null clears the record (a second tap undoes the first).
 * `at_` is the time of the tap, not the time of the call: the offline queue
 * replays gestures made minutes earlier and their hour must survive.
 */
create or replace function public.mark_attendance(
  session_ uuid,
  student_ uuid,
  status_ public.attendance_status default 'present',
  at_ timestamptz default now(),
  departure boolean default false,
  pickup_ uuid default null,
  pickup_note_ text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  s record;
  existing record;
  result uuid;
begin
  select id, school_id, list_id, closed_at into s from public.attendance_sessions where id = session_;
  if not found then
    raise exception 'Pointage introuvable' using errcode = 'no_data_found';
  end if;
  if not public.attendance_can_manage(s.list_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if not public.attendance_student_on_list(session_, student_) then
    raise exception 'Cet élève n''est pas sur cette liste' using errcode = 'check_violation';
  end if;

  select * into existing from public.attendance_records
  where session_id = session_ and student_id = student_;

  -- A second tap on a present child undoes the first, as long as nothing else
  -- was recorded on them.
  if status_ is null then
    if existing.id is not null then
      delete from public.attendance_records where id = existing.id;
      if s.closed_at is not null then
        perform public.log_audit(s.school_id, 'attendance.correct', 'attendance_records', existing.id,
          jsonb_build_object('removed', true));
      end if;
    end if;
    return null;
  end if;

  if existing.id is null then
    insert into public.attendance_records (
      school_id, session_id, student_id, status, arrived_at, departed_at,
      marked_by, pickup_user_id, pickup_note)
    values (
      s.school_id, session_, student_, status_,
      case when departure then null else at_ end,
      case when departure then at_ else null end,
      auth.uid(), pickup_, nullif(btrim(coalesce(pickup_note_, '')), ''))
    returning id into result;
  else
    update public.attendance_records
    set status = status_,
        arrived_at = case when departure then arrived_at else at_ end,
        departed_at = case when departure then at_ else departed_at end,
        marked_by = auth.uid(),
        pickup_user_id = coalesce(pickup_, pickup_user_id),
        pickup_note = coalesce(nullif(btrim(coalesce(pickup_note_, '')), ''), pickup_note)
    where id = existing.id
    returning id into result;
    -- Correcting a closed occurrence is exactly what the audit log is for.
    if s.closed_at is not null then
      perform public.log_audit(s.school_id, 'attendance.correct', 'attendance_records', existing.id,
        jsonb_build_object('status', status_, 'departure', departure));
    end if;
  end if;
  return result;
end
$$;
revoke all on function public.mark_attendance(uuid, uuid, public.attendance_status, timestamptz, boolean, uuid, text) from public, anon;
grant execute on function public.mark_attendance(uuid, uuid, public.attendance_status, timestamptz, boolean, uuid, text) to authenticated, service_role;

/**
 * The undo: a second tap on a child removes what the first one wrote.
 *
 * A separate verb rather than `mark_attendance(status => null)`, because a
 * generated client types an argument with a default as optional, and "omitted"
 * then silently means "present" — the undo would re-mark the child.
 */
create or replace function public.clear_attendance(session_ uuid, student_ uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s record;
  existing uuid;
begin
  select id, school_id, list_id, closed_at into s from public.attendance_sessions where id = session_;
  if not found then
    raise exception 'Pointage introuvable' using errcode = 'no_data_found';
  end if;
  if not public.attendance_can_manage(s.list_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  select id into existing from public.attendance_records
  where session_id = session_ and student_id = student_;
  if existing is null then
    return;
  end if;
  delete from public.attendance_records where id = existing;
  if s.closed_at is not null then
    perform public.log_audit(s.school_id, 'attendance.correct', 'attendance_records', existing,
      jsonb_build_object('removed', true));
  end if;
end
$$;
revoke all on function public.clear_attendance(uuid, uuid) from public, anon;
grant execute on function public.clear_attendance(uuid, uuid) to authenticated, service_role;

/**
 * The grid: one row per expected child, with what was pointed, who may collect
 * them, and whether their family already declared them absent (arbitrage 8 —
 * the two registers stay independent, but the person pointing should not hunt
 * for a child who is known to be away).
 */
create or replace function public.attendance_roster(session_ uuid)
returns table (
  student_id uuid, first_name text, last_name text, photo_path text, class_name text,
  record_id uuid, status public.attendance_status, arrived_at timestamptz, departed_at timestamptz,
  pickup_user_id uuid, pickup_name text, declared_absent boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  s record;
begin
  select id, list_id, on_date into s from public.attendance_sessions where id = session_;
  if not found then
    raise exception 'Pointage introuvable' using errcode = 'no_data_found';
  end if;
  if not public.attendance_can_manage(s.list_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
  select st.id, st.first_name, st.last_name, st.photo_path, c.name,
         r.id, r.status, r.arrived_at, r.departed_at,
         r.pickup_user_id,
         case when r.pickup_user_id is null then null
              else (select p.first_name || ' ' || p.last_name from public.profiles p where p.id = r.pickup_user_id)
         end,
         exists (
           select 1 from public.absences a
           where a.student_id = st.id and a.kind = 'absence'
             and s.on_date between a.starts_on and a.ends_on
         )
  from public.students st
  left join public.enrollments e on e.student_id = st.id and e.left_on is null
  left join public.classes c on c.id = e.class_id
  left join public.attendance_records r on r.session_id = session_ and r.student_id = st.id
  where st.id in (select public.attendance_list_students(s.list_id))
  order by st.first_name, st.last_name;
end
$$;
revoke all on function public.attendance_roster(uuid) from public, anon;
grant execute on function public.attendance_roster(uuid) to authenticated, service_role;

/** The guardians a child may be handed over to — never a blocked one. */
create or replace function public.attendance_pickup_options(student_ uuid)
returns table (user_id uuid, full_name text, relation public.guardian_relation, is_primary boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.can_access_student(student_) or public.is_school_staff(
      (select school_id from public.students where id = student_))) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
  select sg.user_id, p.first_name || ' ' || p.last_name, sg.relation, sg.is_primary
  from public.student_guardians sg
  join public.profiles p on p.id = sg.user_id
  where sg.student_id = student_ and not sg.access_blocked
  order by sg.is_primary desc, p.last_name;
end
$$;
revoke all on function public.attendance_pickup_options(uuid) from public, anon;
grant execute on function public.attendance_pickup_options(uuid) to authenticated, service_role;

/** The lists the caller may point today, with the state of today's occurrence. */
create or replace function public.my_attendance_lists(on_date_ date default null)
returns table (
  list_id uuid, kind public.attendance_list_kind, name text, class_id uuid, class_name text,
  records_pickup boolean, scheduled_today boolean, session_id uuid, closed_at timestamptz,
  expected bigint, present bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare
  day_ date := coalesce(on_date_, current_date);
begin
  return query
  select l.id, l.kind, l.name, l.class_id, c.name, l.records_pickup,
         (coalesce(array_length(l.weekdays, 1), 0) = 0
           or extract(isodow from day_)::smallint = any (l.weekdays))
         and (l.starts_on is null or day_ >= l.starts_on)
         and (l.ends_on is null or day_ <= l.ends_on),
         s.id, s.closed_at,
         (select count(*) from public.attendance_list_students(l.id)),
         coalesce((select count(*) from public.attendance_records r
                   where r.session_id = s.id and r.status in ('present', 'late')), 0)
  from public.attendance_lists l
  left join public.classes c on c.id = l.class_id
  left join public.attendance_sessions s on s.list_id = l.id and s.on_date = day_
  where not l.archived and public.attendance_can_manage(l.id)
  order by l.kind, l.name;
end
$$;
revoke all on function public.my_attendance_lists(date) from public, anon;
grant execute on function public.my_attendance_lists(date) to authenticated, service_role;

/** What a guardian sees of their own child, on the lists opened to families. */
create or replace function public.child_attendance(student_ uuid, days integer default 14)
returns table (
  on_date date, list_name text, kind public.attendance_list_kind,
  status public.attendance_status, arrived_at timestamptz, departed_at timestamptz, pickup_name text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_access_student(student_) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  return query
  select ses.on_date, l.name, l.kind, r.status, r.arrived_at, r.departed_at,
         case when r.pickup_user_id is null then null
              else (select p.first_name || ' ' || p.last_name from public.profiles p where p.id = r.pickup_user_id)
         end
  from public.attendance_records r
  join public.attendance_sessions ses on ses.id = r.session_id
  join public.attendance_lists l on l.id = ses.list_id
  where r.student_id = student_ and l.visible_to_guardians
    and ses.on_date >= current_date - greatest(coalesce(days, 14), 1)
  order by ses.on_date desc, l.name;
end
$$;
revoke all on function public.child_attendance(uuid, integer) from public, anon;
grant execute on function public.child_attendance(uuid, integer) to authenticated, service_role;

-- ── retention (arbitrage 7 : 12 mois glissants) ──────────────────────────────
-- Attendance is minors' presence data: the shortest span that still covers the
-- school year just gone and a possible after-school billing dispute.
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  n_messages integer;
  n_notifications integer;
  n_deliveries integer;
  n_audit integer;
  n_classifieds integer;
  n_media integer;
  n_students integer;
  n_attendance integer;
  n_windows integer;
begin
  if not public.is_service_role() then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  delete from public.messages where created_at < now() - interval '2 years';
  get diagnostics n_messages = row_count;
  delete from public.notifications where created_at < now() - interval '6 months';
  get diagnostics n_notifications = row_count;
  delete from public.notification_deliveries where sent_at is not null and sent_at < now() - interval '30 days';
  get diagnostics n_deliveries = row_count;
  delete from public.audit_log where created_at < now() - interval '3 years';
  get diagnostics n_audit = row_count;
  delete from public.community_posts
  where (deleted_at is not null and deleted_at < now() - interval '90 days')
     or (status in ('archived', 'rejected') and updated_at < now() - interval '90 days');
  get diagnostics n_classifieds = row_count;

  -- photos showing a student who left the school
  delete from public.class_post_media m
  using public.students s
  where s.id = any (m.tagged_student_ids)
    and s.status in ('left', 'archived')
    and not exists (
      select 1 from public.enrollments e
      where e.student_id = s.id and (e.left_on is null or e.left_on >= current_date)
    );
  get diagnostics n_media = row_count;

  -- attendance: twelve rolling months, records cascade with their occurrence
  delete from public.attendance_sessions where on_date < current_date - interval '12 months';
  get diagnostics n_attendance = row_count;

  -- messaging periods that closed more than a year ago say nothing to anyone
  delete from public.messaging_windows where closes_at < now() - interval '1 year';
  get diagnostics n_windows = row_count;

  -- identity kept until 1 August following the school year after departure
  update public.students s
  set first_name = 'Élève', last_name = 'parti·e', birth_date = null, allergies_note = null,
      photo_path = null, deleted_at = now()
  where s.status in ('left', 'archived') and s.deleted_at is null
    and not exists (select 1 from public.enrollments e where e.student_id = s.id and e.left_on is null)
    and make_date(
      extract(year from (coalesce((select max(e.left_on) from public.enrollments e where e.student_id = s.id), s.updated_at::date) + interval '4 months'))::int + 1,
      8, 1
    ) <= current_date;
  get diagnostics n_students = row_count;

  return jsonb_build_object(
    'messages', n_messages, 'notifications', n_notifications, 'deliveries', n_deliveries,
    'audit_log', n_audit, 'classifieds', n_classifieds, 'media', n_media, 'students', n_students,
    'attendance', n_attendance, 'messaging_windows', n_windows
  );
end
$$;
revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;

-- `purge_messaging_windows` is folded into the nightly purge above.
drop function if exists public.purge_messaging_windows();
