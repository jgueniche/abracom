-- Notifications (session 10): delivery planning from user preferences, fan-out for announcements,
-- documents, class posts, individual notes, messages, reports and absences, claim / digest
-- functions for the dispatch job (Web Push + e-mail), Shabbat mode handled by the job.

-- ── bookkeeping ──────────────────────────────────────────────────────────────
alter table public.notifications add column digested_at timestamptz;
alter table public.announcements add column notified_at timestamptz;
alter table public.documents add column notified_at timestamptz;
alter table public.class_posts add column notified_at timestamptz;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel public.notification_channel not null check (channel in ('push', 'email')),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  attempts smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_pending_idx on public.notification_deliveries (scheduled_for)
  where sent_at is null;
create index notification_deliveries_user_id_idx on public.notification_deliveries (user_id);
alter table public.notification_deliveries enable row level security;
create policy notification_deliveries_select on public.notification_deliveries for select to authenticated
  using (user_id = (select auth.uid()));
-- writes: the planning trigger and the service role only

-- ── preferences ──────────────────────────────────────────────────────────────
-- Preference rows are keyed by group for channels ('announcement', 'document', 'class', 'message',
-- 'event', 'absence', 'moderation', 'community') and by '*' for quiet hours / Shabbat mode.
create or replace function public.notification_group(kind text)
returns text
language sql immutable
as $$
  select case
    when kind like 'announcement.%' then 'announcement'
    when kind like 'document.%' then 'document'
    when kind like 'class_post.%' or kind like 'note.%' then 'class'
    when kind like 'message.%' then 'message'
    when kind like 'event.%' then 'event'
    when kind like 'absence.%' then 'absence'
    when kind like 'report.%' then 'moderation'
    when kind like 'community.%' then 'community'
    else 'other'
  end;
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
    coalesce((select shabbat_mode from global), true);
$$;
revoke all on function public.effective_preference(uuid, text) from public, anon;
grant execute on function public.effective_preference(uuid, text) to authenticated, service_role;

-- Plans push / e-mail deliveries for every in-app notification (messages are never e-mailed one
-- by one, brief §7.8: digest + push).
create or replace function public.plan_notification_delivery()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  pref record;
begin
  if new.channel <> 'inapp' then
    return new;
  end if;
  select * into pref from public.effective_preference(new.user_id, new.kind);
  if pref.push and exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    insert into public.notification_deliveries (notification_id, user_id, channel, scheduled_for)
    values (new.id, new.user_id, 'push', new.scheduled_for)
    on conflict do nothing;
  end if;
  if pref.email and public.notification_group(new.kind) <> 'message' then
    insert into public.notification_deliveries (notification_id, user_id, channel, scheduled_for)
    values (new.id, new.user_id, 'email', new.scheduled_for)
    on conflict do nothing;
  end if;
  return new;
end
$$;
create trigger notifications_plan_delivery
  after insert on public.notifications
  for each row execute function public.plan_notification_delivery();

-- ── helpers ──────────────────────────────────────────────────────────────────
-- True for the service key (PostgREST sets the `role` claim) and for pg_cron / psql sessions.
create or replace function public.is_service_role()
returns boolean
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
$$;

-- Active guardians of the students enrolled in a class who accept notifications.
create or replace function public.class_notification_recipients(class_ uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct sg.user_id
  from public.enrollments e
  join public.student_guardians sg on sg.student_id = e.student_id
    and not sg.access_blocked and sg.receives_notifications
  join public.classes c on c.id = e.class_id
  join public.memberships m on m.user_id = sg.user_id and m.school_id = c.school_id
    and m.status = 'active' and m.role in ('parent', 'guardian')
  where e.class_id = class_ and (e.left_on is null or e.left_on >= current_date);
$$;

create or replace function public.school_staff_ids(school uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct m.user_id
  from public.memberships m
  where m.school_id = school and m.status = 'active' and m.role in ('school_admin', 'staff');
$$;

-- ── fan-out: published content (announcements, documents, class posts) ───────
-- Idempotent through `notified_at`; run by the dispatch job and right after publishing.
create or replace function public.notify_due_content()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n integer;
  total integer := 0;
begin
  if not public.is_service_role() and not exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.role in ('school_admin', 'staff', 'teacher')
  ) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;

  for r in
    select * from public.announcements
    where published_at is not null and published_at <= now() and notified_at is null and deleted_at is null
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
revoke all on function public.notify_due_content() from public, anon;
grant execute on function public.notify_due_content() to authenticated, service_role;

-- ── fan-out triggers ─────────────────────────────────────────────────────────
-- Individual note → guardians of the student (unless staff-only).
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
    and (new.author_id is null or sg.user_id <> new.author_id);
  return new;
end
$$;
create trigger individual_notes_notify
  after insert on public.individual_notes
  for each row execute function public.notify_individual_note();

-- Message → other members of the thread, unless muted.
create or replace function public.notify_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  t public.threads%rowtype;
  author_name text;
begin
  select * into t from public.threads where id = new.thread_id;
  select p.first_name || ' ' || p.last_name into author_name from public.profiles p where p.id = new.author_id;
  insert into public.notifications (user_id, school_id, kind, payload)
  select tm.user_id, t.school_id, 'message.new',
         jsonb_build_object('thread_id', t.id, 'message_id', new.id, 'thread_kind', t.kind,
                            'thread_title', t.title, 'author_name', author_name,
                            'preview', left(new.body, 140))
  from public.thread_members tm
  where tm.thread_id = new.thread_id and not tm.muted
    and (new.author_id is null or tm.user_id <> new.author_id);
  return new;
end
$$;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_message();

-- Report → school staff.
create or replace function public.notify_report()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  thread uuid;
begin
  select m.thread_id into thread from public.messages m where m.id = new.message_id;
  insert into public.notifications (user_id, school_id, kind, payload)
  select s, new.school_id, 'report.new',
         jsonb_build_object('report_id', new.id, 'message_id', new.message_id, 'thread_id', thread)
  from public.school_staff_ids(new.school_id) s
  where new.reporter_id is null or s <> new.reporter_id;
  return new;
end
$$;
create trigger reports_notify
  after insert on public.reports
  for each row execute function public.notify_report();

-- Absence declared → staff; absence reviewed → the parent who declared it.
create or replace function public.notify_absence()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s record;
begin
  select st.first_name || ' ' || st.last_name as student_name, e.class_id
  into s
  from public.students st
  left join public.enrollments e on e.student_id = st.id and (e.left_on is null or e.left_on >= current_date)
  where st.id = new.student_id
  order by e.joined_on desc nulls last
  limit 1;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, school_id, kind, payload)
    select staff, new.school_id, 'absence.new',
           jsonb_build_object('absence_id', new.id, 'student_id', new.student_id, 'student_name', s.student_name,
                              'class_id', s.class_id, 'starts_on', new.starts_on, 'ends_on', new.ends_on)
    from public.school_staff_ids(new.school_id) staff
    where new.declared_by is null or staff <> new.declared_by;
  elsif new.status is distinct from old.status and new.status::text <> 'declared' and new.declared_by is not null then
    insert into public.notifications (user_id, school_id, kind, payload)
    values (new.declared_by, new.school_id, 'absence.reviewed',
            jsonb_build_object('absence_id', new.id, 'student_id', new.student_id, 'student_name', s.student_name,
                               'class_id', s.class_id, 'status', new.status));
  end if;
  return new;
end
$$;
create trigger absences_notify
  after insert or update of status on public.absences
  for each row execute function public.notify_absence();

-- ── dispatch job (service role) ──────────────────────────────────────────────
-- Claims due deliveries (locked, attempts incremented) with everything the job needs.
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
      set attempts = d.attempts + 1
      where d.id in (
        select x.id from public.notification_deliveries x
        where x.sent_at is null and x.scheduled_for <= now() and x.attempts < 5
        order by x.scheduled_for
        limit batch
        for update skip locked
      )
      returning d.*
    )
    select c.id, c.channel, c.attempts, n.id, n.user_id, n.kind, n.payload, n.created_at,
           u.email::text, p.locale, p.first_name,
           pref.quiet_hours, pref.shabbat_mode,
           n.school_id, s.timezone, s.latitude, s.longitude
    from claimed c
    join public.notifications n on n.id = c.notification_id
    join auth.users u on u.id = n.user_id
    join public.profiles p on p.id = n.user_id
    left join public.schools s on s.id = n.school_id
    cross join lateral public.effective_preference(n.user_id, n.kind) pref;
end
$$;
revoke all on function public.claim_notification_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer) to service_role;

-- Unread notifications of the last `since` window, not e-mailed one by one, for the 18:00 digest.
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
        where d.notification_id = n.id and d.channel = 'email' and d.sent_at is not null
      )
    order by n.user_id, n.created_at;
end
$$;
revoke all on function public.digest_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.digest_candidates(timestamptz) to service_role;
