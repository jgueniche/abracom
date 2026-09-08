-- Agenda (session 9): RSVP with capacity and waiting list, volunteer slot capacity,
-- private ICS feeds, event notifications and J-7 / J-1 reminders.

-- ── waiting list ─────────────────────────────────────────────────────────────
alter table public.event_rsvps
  add column waitlisted boolean not null default false,
  add column waitlisted_at timestamptz;

-- Same rule as the events_select policy, usable from security definer functions.
create or replace function public.can_view_event(event uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = event
      and (
        public.is_school_staff(e.school_id, uid)
        or e.created_by = uid
        or (
          e.deleted_at is null
          and public.matches_audience(e.school_id, e.scope::text::public.audience_kind, e.target_ids, uid)
        )
      )
  );
$$;

-- Aggregated attendance for anyone who can see the event (no personal data).
create or replace function public.event_counts(event uuid)
returns table (
  yes_count integer, yes_seats integer, maybe_count integer, no_count integer,
  waitlisted_count integer, waitlisted_seats integer
)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where r.status = 'yes' and not r.waitlisted)::integer,
    coalesce(sum(1 + r.guests_count) filter (where r.status = 'yes' and not r.waitlisted), 0)::integer,
    count(*) filter (where r.status = 'maybe')::integer,
    count(*) filter (where r.status = 'no')::integer,
    count(*) filter (where r.status = 'yes' and r.waitlisted)::integer,
    coalesce(sum(1 + r.guests_count) filter (where r.status = 'yes' and r.waitlisted), 0)::integer
  from public.event_rsvps r
  where r.event_id = event and public.can_view_event(event, auth.uid());
$$;
revoke all on function public.event_counts(uuid) from public, anon;
grant execute on function public.event_counts(uuid) to authenticated, service_role;

-- Promotes waiting-list RSVPs (oldest first) while seats remain; notifies promoted users.
create or replace function public.promote_event_waitlist(event uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  e public.events%rowtype;
  used integer;
  promoted integer := 0;
  r record;
begin
  select * into e from public.events where id = event;
  if e.id is null then
    return 0;
  end if;
  if e.capacity is null then
    update public.event_rsvps set waitlisted = false, waitlisted_at = null
    where event_id = e.id and waitlisted;
    get diagnostics promoted = row_count;
    return promoted;
  end if;
  select coalesce(sum(1 + guests_count), 0) into used
  from public.event_rsvps
  where event_id = e.id and status = 'yes' and not waitlisted;
  for r in
    select user_id, guests_count
    from public.event_rsvps
    where event_id = e.id and status = 'yes' and waitlisted
    order by waitlisted_at, created_at
  loop
    exit when used + 1 + r.guests_count > e.capacity;
    update public.event_rsvps set waitlisted = false, waitlisted_at = null
    where event_id = e.id and user_id = r.user_id;
    insert into public.notifications (user_id, school_id, kind, payload)
    values (r.user_id, e.school_id, 'event.confirmed', jsonb_build_object('event_id', e.id, 'title', e.title));
    used := used + 1 + r.guests_count;
    promoted := promoted + 1;
  end loop;
  return promoted;
end
$$;
revoke all on function public.promote_event_waitlist(uuid) from public, anon, authenticated;

-- RSVP with deadline, capacity and waiting list. Read-only guardians cannot answer.
create or replace function public.rsvp_event(
  event uuid, answer public.rsvp_status, guests integer default 0, note text default null, student uuid default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  e public.events%rowtype;
  uid uuid := auth.uid();
  seats integer := 0;
  wait boolean := false;
begin
  select * into e from public.events where id = event and deleted_at is null;
  if e.id is null then
    raise exception 'Événement introuvable' using errcode = 'no_data_found';
  end if;
  if uid is null or not public.can_view_event(e.id, uid) or not public.can_write_in_school(e.school_id, uid) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if not e.requires_rsvp then
    raise exception 'Cet événement ne demande pas de réponse' using errcode = 'check_violation';
  end if;
  if e.rsvp_deadline is not null and e.rsvp_deadline < now() then
    raise exception 'La date limite de réponse est dépassée' using errcode = 'check_violation';
  end if;
  if guests is null or guests < 0 or guests > 20 then
    raise exception 'Nombre d''accompagnants invalide' using errcode = 'check_violation';
  end if;
  if student is not null and not public.can_access_student(student, uid) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if answer = 'yes' and e.capacity is not null then
    select coalesce(sum(1 + r.guests_count), 0) into seats
    from public.event_rsvps r
    where r.event_id = e.id and r.status = 'yes' and not r.waitlisted and r.user_id <> uid;
    wait := seats + 1 + guests > e.capacity;
  end if;
  insert into public.event_rsvps (event_id, user_id, student_id, status, guests_count, note, waitlisted, waitlisted_at)
  values (e.id, uid, student, answer, guests, nullif(trim(note), ''), wait, case when wait then now() end)
  on conflict (event_id, user_id) do update
    set status = excluded.status,
        guests_count = excluded.guests_count,
        note = excluded.note,
        student_id = excluded.student_id,
        waitlisted = excluded.waitlisted,
        waitlisted_at = case when excluded.waitlisted then coalesce(event_rsvps.waitlisted_at, now()) else null end;
  perform public.promote_event_waitlist(e.id);
  return (select r.waitlisted from public.event_rsvps r where r.event_id = e.id and r.user_id = uid);
end
$$;
revoke all on function public.rsvp_event(uuid, public.rsvp_status, integer, text, uuid) from public, anon;
grant execute on function public.rsvp_event(uuid, public.rsvp_status, integer, text, uuid) to authenticated, service_role;

-- Direct writes go through rsvp_event() from now on; reading is unchanged.
drop policy if exists event_rsvps_write on public.event_rsvps;

-- ── volunteer slots: capacity + read-only guardians ──────────────────────────
create or replace function public.check_slot_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s public.event_slots%rowtype;
  e public.events%rowtype;
  taken integer;
begin
  select * into s from public.event_slots where id = new.slot_id;
  select * into e from public.events where id = s.event_id;
  if e.id is null or e.deleted_at is not null then
    raise exception 'Événement introuvable' using errcode = 'no_data_found';
  end if;
  if not public.can_write_in_school(e.school_id, new.user_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  select count(*) into taken from public.event_slot_signups where slot_id = new.slot_id;
  if taken >= s.needed then
    raise exception 'Créneau complet' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger event_slot_signups_capacity
  before insert on public.event_slot_signups
  for each row execute function public.check_slot_capacity();

-- ── private ICS feeds ─────────────────────────────────────────────────────────
create table public.calendar_feeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  include_holidays boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
create policy calendar_feeds_select on public.calendar_feeds for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert / update policy: rows are managed by my_calendar_feed() and rotate_calendar_feed().

create or replace function public.my_calendar_feed(with_holidays boolean default null)
returns public.calendar_feeds
language plpgsql security definer set search_path = public
as $$
declare
  f public.calendar_feeds;
begin
  if auth.uid() is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  insert into public.calendar_feeds (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  if with_holidays is not null then
    update public.calendar_feeds set include_holidays = with_holidays where user_id = auth.uid();
  end if;
  select * into f from public.calendar_feeds where user_id = auth.uid();
  return f;
end
$$;
revoke all on function public.my_calendar_feed(boolean) from public, anon;
grant execute on function public.my_calendar_feed(boolean) to authenticated, service_role;

create or replace function public.rotate_calendar_feed()
returns public.calendar_feeds
language plpgsql security definer set search_path = public
as $$
declare
  f public.calendar_feeds;
begin
  if auth.uid() is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  insert into public.calendar_feeds (user_id) values (auth.uid())
  on conflict (user_id) do update
    set token = encode(extensions.gen_random_bytes(24), 'hex'), rotated_at = now();
  select * into f from public.calendar_feeds where user_id = auth.uid();
  return f;
end
$$;
revoke all on function public.rotate_calendar_feed() from public, anon;
grant execute on function public.rotate_calendar_feed() to authenticated, service_role;

-- Feed metadata for the ICS route (called with the anonymous key: the token is the secret).
create or replace function public.calendar_feed(feed_token text)
returns table (
  user_id uuid, include_holidays boolean, locale text, school_name text, timezone text,
  latitude double precision, longitude double precision
)
language sql stable security definer set search_path = public
as $$
  select f.user_id, f.include_holidays, p.locale, s.name, s.timezone, s.latitude, s.longitude
  from public.calendar_feeds f
  join public.profiles p on p.id = f.user_id
  left join public.memberships m on m.user_id = f.user_id and m.status = 'active'
  left join public.schools s on s.id = m.school_id
  where f.token = feed_token
  order by m.created_at
  limit 1;
$$;
revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated, service_role;

-- Events of the feed owner (current school year; same visibility as the events_select policy).
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
    and (
      public.is_school_staff(e.school_id, f.user_id)
      or e.created_by = f.user_id
      or public.matches_audience(e.school_id, e.scope::text::public.audience_kind, e.target_ids, f.user_id)
    )
  order by e.starts_at;
$$;
revoke all on function public.calendar_feed_events(text) from public;
grant execute on function public.calendar_feed_events(text) to anon, authenticated, service_role;

-- ── recipients, notifications, reminders ─────────────────────────────────────
-- Members addressed by an event with their answer (staff and creator only).
create or replace function public.event_recipients(event uuid)
returns table (
  user_id uuid, first_name text, last_name text, role public.membership_role,
  status public.rsvp_status, guests_count smallint, waitlisted boolean, note text, answered_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare
  e public.events%rowtype;
begin
  select * into e from public.events where id = event;
  if e.id is null or not (public.is_school_staff(e.school_id, auth.uid()) or e.created_by = auth.uid()) then
    return;
  end if;
  return query
    select distinct on (m.user_id)
      m.user_id, p.first_name, p.last_name, m.role, r.status, r.guests_count, r.waitlisted, r.note, r.updated_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join public.event_rsvps r on r.event_id = e.id and r.user_id = m.user_id
    where m.school_id = e.school_id
      and m.status = 'active'
      and m.role in ('parent', 'guardian', 'teacher', 'staff', 'school_admin')
      and public.matches_audience(e.school_id, e.scope::text::public.audience_kind, e.target_ids, m.user_id)
    order by m.user_id, m.role;
end
$$;
revoke all on function public.event_recipients(uuid) from public, anon;
grant execute on function public.event_recipients(uuid) to authenticated, service_role;

-- In-app notification to every recipient when an event is published (idempotent).
create or replace function public.notify_event(event uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  e public.events%rowtype;
  inserted integer;
begin
  select * into e from public.events where id = event and deleted_at is null;
  if e.id is null then
    raise exception 'Événement introuvable' using errcode = 'no_data_found';
  end if;
  if not (public.is_school_staff(e.school_id, auth.uid()) or e.created_by = auth.uid()) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  insert into public.notifications (user_id, school_id, kind, payload)
  select r.user_id, e.school_id, 'event.new',
         jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at)
  from public.event_recipients(e.id) r
  where r.user_id <> auth.uid()
    and not exists (
      select 1 from public.notifications n
      where n.user_id = r.user_id and n.kind = 'event.new' and n.payload->>'event_id' = e.id::text
    );
  get diagnostics inserted = row_count;
  return inserted;
end
$$;
revoke all on function public.notify_event(uuid) from public, anon;
grant execute on function public.notify_event(uuid) to authenticated, service_role;

-- J-7 / J-1 reminders, idempotent. Scheduled by pg_cron in session 10 (service role only).
-- J-7 targets people who have not answered yet; J-1 targets confirmed / maybe attendees
-- (everyone when the event has no RSVP).
create or replace function public.queue_event_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  inserted integer := 0;
  n integer;
  e record;
  days integer;
begin
  for e in
    select ev.*, s.timezone
    from public.events ev
    join public.schools s on s.id = ev.school_id
    where ev.deleted_at is null
      and ev.starts_at > now()
      and ev.starts_at < now() + interval '8 days'
  loop
    days := (e.starts_at at time zone e.timezone)::date - (now() at time zone e.timezone)::date;
    if days not in (1, 7) then
      continue;
    end if;
    insert into public.notifications (user_id, school_id, kind, payload)
    select distinct m.user_id, e.school_id, 'event.reminder',
           jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'days', days)
    from public.memberships m
    left join public.event_rsvps r on r.event_id = e.id and r.user_id = m.user_id
    where m.school_id = e.school_id
      and m.status = 'active'
      and m.role in ('parent', 'guardian', 'teacher', 'staff', 'school_admin')
      and public.matches_audience(e.school_id, e.scope::text::public.audience_kind, e.target_ids, m.user_id)
      and (
        (days = 7 and (not e.requires_rsvp or r.status is null))
        or (days = 1 and (not e.requires_rsvp or r.status in ('yes', 'maybe')))
      )
      and not exists (
        select 1 from public.notifications x
        where x.user_id = m.user_id
          and x.kind = 'event.reminder'
          and x.payload->>'event_id' = e.id::text
          and (x.payload->>'days')::integer = days
      );
    get diagnostics n = row_count;
    inserted := inserted + n;
  end loop;
  return inserted;
end
$$;
revoke all on function public.queue_event_reminders() from public, anon, authenticated;
grant execute on function public.queue_event_reminders() to service_role;
