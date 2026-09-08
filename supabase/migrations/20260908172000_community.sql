-- Community (session 12): opt-in directory per class, birthdays, classifieds with a-priori
-- moderation, parent-teacher appointments (one per family), forms notified to their audience.

alter table public.directory_optins add column show_birthday boolean not null default false;
alter table public.forms add column notified_at timestamptz;

-- ── directory ────────────────────────────────────────────────────────────────
-- Guardians of a class who opted in, exposing only the fields they chose (callers with class access).
create or replace function public.class_directory(class_ uuid)
returns table (
  user_id uuid, first_name text, last_name text, relation public.guardian_relation,
  phone text, email text, address text, children text[]
)
language sql stable security definer set search_path = public
as $$
  select d.user_id, d.first_name, d.last_name, d.relation, d.phone, d.email, d.address, d.children
  from (
    select distinct on (sg.user_id)
      sg.user_id, p.first_name, p.last_name, sg.relation,
      case when o.show_phone then p.phone end as phone,
      case when o.show_email then u.email::text end as email,
      case when o.show_address then o.address end as address,
      case when o.show_children_names then array(
        select s2.first_name
        from public.enrollments e2
        join public.students s2 on s2.id = e2.student_id
        join public.student_guardians sg2 on sg2.student_id = s2.id and sg2.user_id = sg.user_id
        where e2.class_id = class_ and (e2.left_on is null or e2.left_on >= current_date)
        order by s2.first_name
      ) else '{}'::text[] end as children
    from public.enrollments e
    join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
    join public.classes c on c.id = e.class_id
    join public.memberships m on m.user_id = sg.user_id and m.school_id = c.school_id
      and m.status = 'active' and m.role in ('parent', 'guardian')
    join public.profiles p on p.id = sg.user_id
    join auth.users u on u.id = sg.user_id
    join public.directory_optins o on o.user_id = sg.user_id and o.school_id = c.school_id
    where e.class_id = class_ and (e.left_on is null or e.left_on >= current_date)
      and public.can_access_class(class_, auth.uid())
      and (o.show_phone or o.show_email or o.show_children_names or o.show_address)
    order by sg.user_id, sg.is_primary desc
  ) d
  order by d.last_name, d.first_name;
$$;
revoke all on function public.class_directory(uuid) from public, anon;
grant execute on function public.class_directory(uuid) to authenticated, service_role;

-- ── birthdays (opt-in through the directory settings) ────────────────────────
create or replace function public.class_birthdays(class_ uuid)
returns table (student_id uuid, first_name text, birth_date date, next_birthday date, turning integer)
language sql stable security definer set search_path = public
as $$
  with base as (
    select s.id, s.first_name, s.birth_date,
           extract(year from age(current_date, s.birth_date))::int as years
    from public.students s
    join public.enrollments e on e.student_id = s.id and e.class_id = class_
      and (e.left_on is null or e.left_on >= current_date)
    where s.birth_date is not null and s.status = 'active'
      and public.can_access_class(class_, auth.uid())
      and exists (
        select 1 from public.student_guardians sg
        join public.directory_optins o on o.user_id = sg.user_id and o.school_id = s.school_id
        where sg.student_id = s.id and o.show_birthday
      )
  )
  select id, first_name, birth_date,
    case when (birth_date + make_interval(years => years))::date >= current_date
         then (birth_date + make_interval(years => years))::date
         else (birth_date + make_interval(years => years + 1))::date end,
    case when (birth_date + make_interval(years => years))::date >= current_date then years else years + 1 end
  from base
  order by 4, 2;
$$;
revoke all on function public.class_birthdays(uuid) from public, anon;
grant execute on function public.class_birthdays(uuid) to authenticated, service_role;

-- Three days ahead, the families of the class are reminded (never the child's own guardians).
create or replace function public.queue_birthday_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  inserted integer := 0;
  n integer;
  r record;
begin
  if not public.is_service_role() then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  for r in
    select s.id, s.first_name, s.school_id, e.class_id, c.name as class_name, (current_date + 3) as bday
    from public.students s
    join public.enrollments e on e.student_id = s.id and (e.left_on is null or e.left_on >= current_date)
    join public.classes c on c.id = e.class_id
    where s.status = 'active' and s.birth_date is not null
      and to_char(s.birth_date, 'MM-DD') = to_char(current_date + 3, 'MM-DD')
      and exists (
        select 1 from public.student_guardians sg
        join public.directory_optins o on o.user_id = sg.user_id and o.school_id = s.school_id
        where sg.student_id = s.id and o.show_birthday
      )
  loop
    insert into public.notifications (user_id, school_id, kind, payload)
    select g, r.school_id, 'community.birthday',
           jsonb_build_object('student_id', r.id, 'student_name', r.first_name, 'class_id', r.class_id,
                              'class_name', r.class_name, 'date', r.bday)
    from public.class_notification_recipients(r.class_id) g
    where g not in (select sg.user_id from public.student_guardians sg where sg.student_id = r.id)
      and not exists (
        select 1 from public.notifications x
        where x.user_id = g and x.kind = 'community.birthday'
          and x.payload->>'student_id' = r.id::text and x.payload->>'date' = r.bday::text
      );
    get diagnostics n = row_count;
    inserted := inserted + n;
  end loop;
  return inserted;
end
$$;
revoke all on function public.queue_birthday_reminders() from public, anon, authenticated;
grant execute on function public.queue_birthday_reminders() to service_role;

-- ── classifieds: a-priori moderation enforced in the database ────────────────
-- Non-staff posts start as `pending` unless the school sets modules.marketplace.moderation = "none";
-- authors may only archive their posts, and editing a published post sends it back to moderation.
create or replace function public.guard_community_post()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  staff boolean := public.is_school_staff(new.school_id, auth.uid());
  prior boolean;
begin
  select coalesce((s.modules -> 'marketplace' ->> 'moderation') <> 'none', true)
  into prior from public.schools s where s.id = new.school_id;
  if tg_op = 'INSERT' then
    if not staff then
      new.status := case when prior then 'pending' else 'published' end;
      new.moderated_by := null;
      new.moderated_at := null;
      new.expires_at := least(new.expires_at, now() + interval '30 days');
    end if;
    return new;
  end if;
  if not staff then
    if new.status is distinct from old.status and new.status <> 'archived' then
      raise exception 'Seule l''équipe peut modifier le statut' using errcode = 'insufficient_privilege';
    end if;
    new.moderated_by := old.moderated_by;
    new.moderated_at := old.moderated_at;
    if old.status = 'published' and prior
       and (new.title, new.body, new.category) is distinct from (old.title, old.body, old.category) then
      new.status := 'pending';
    end if;
  end if;
  return new;
end
$$;
create trigger community_posts_guard
  before insert or update on public.community_posts
  for each row execute function public.guard_community_post();

create or replace function public.notify_community_post()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, school_id, kind, payload)
    select s, new.school_id, 'community.pending', jsonb_build_object('post_id', new.id, 'title', new.title)
    from public.school_staff_ids(new.school_id) s
    where new.author_id is null or s <> new.author_id;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status
        and new.status in ('published', 'rejected') and new.author_id is not null
        and new.moderated_by is not null and new.moderated_by <> new.author_id then
    insert into public.notifications (user_id, school_id, kind, payload)
    values (new.author_id, new.school_id, 'community.moderated',
            jsonb_build_object('post_id', new.id, 'title', new.title, 'status', new.status));
  end if;
  return new;
end
$$;
create trigger community_posts_notify
  after insert or update on public.community_posts
  for each row execute function public.notify_community_post();

create or replace function public.expire_community_posts()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_service_role() then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  update public.community_posts set status = 'archived'
  where status = 'published' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.expire_community_posts() from public, anon, authenticated;
grant execute on function public.expire_community_posts() to service_role;

-- ── parent-teacher appointments ──────────────────────────────────────────────
create or replace function public.book_appointment(slot uuid, student uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.appointment_slots%rowtype;
  uid uuid := auth.uid();
  fam uuid;
  names record;
begin
  select * into s from public.appointment_slots where id = slot for update;
  if s.id is null then
    raise exception 'Créneau introuvable' using errcode = 'no_data_found';
  end if;
  if uid is null or not public.can_write_in_school(s.school_id, uid)
     or student not in (select public.guardian_student_ids(uid)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.enrollments e
    where e.student_id = student and e.class_id = s.class_id and (e.left_on is null or e.left_on >= current_date)
  ) then
    raise exception 'Cet enfant n''est pas inscrit dans cette classe' using errcode = 'check_violation';
  end if;
  if s.booked_by is not null then
    raise exception 'Ce créneau vient d''être réservé' using errcode = 'check_violation';
  end if;
  if s.starts_at < now() then
    raise exception 'Ce créneau est passé' using errcode = 'check_violation';
  end if;
  select family_id into fam from public.students where id = student;
  if exists (
    select 1 from public.appointment_slots x
    left join public.students st on st.id = x.student_id
    where x.class_id = s.class_id and x.teacher_id = s.teacher_id and x.booked_by is not null
      and x.starts_at >= now()
      and (x.booked_by = uid or (fam is not null and st.family_id = fam))
  ) then
    raise exception 'Un seul rendez-vous par famille pour cette classe' using errcode = 'check_violation';
  end if;
  update public.appointment_slots set booked_by = uid, student_id = student, booked_at = now() where id = slot;
  select st.first_name || ' ' || st.last_name as student_name, p.first_name || ' ' || p.last_name as parent_name
  into names
  from public.students st, public.profiles p
  where st.id = student and p.id = uid;
  insert into public.notifications (user_id, school_id, kind, payload)
  values (s.teacher_id, s.school_id, 'appointment.booked',
          jsonb_build_object('slot_id', s.id, 'class_id', s.class_id, 'starts_at', s.starts_at,
                             'student_name', names.student_name, 'parent_name', names.parent_name));
end
$$;
revoke all on function public.book_appointment(uuid, uuid) from public, anon;
grant execute on function public.book_appointment(uuid, uuid) to authenticated, service_role;

create or replace function public.cancel_appointment(slot uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.appointment_slots%rowtype;
  uid uuid := auth.uid();
  by_family boolean;
begin
  select * into s from public.appointment_slots where id = slot for update;
  if s.id is null or s.booked_by is null then
    raise exception 'Créneau introuvable' using errcode = 'no_data_found';
  end if;
  by_family := s.booked_by = uid;
  if not (by_family or public.is_class_teacher(s.class_id, uid) or public.is_school_staff(s.school_id, uid)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  insert into public.notifications (user_id, school_id, kind, payload)
  values (case when by_family then s.teacher_id else s.booked_by end, s.school_id, 'appointment.cancelled',
          jsonb_build_object('slot_id', s.id, 'class_id', s.class_id, 'starts_at', s.starts_at));
  update public.appointment_slots set booked_by = null, student_id = null, booked_at = null where id = slot;
end
$$;
revoke all on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.cancel_appointment(uuid) to authenticated, service_role;

-- ── forms: notify the audience once a form opens ─────────────────────────────
create or replace function public.notify_due_forms()
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
    where m.user_id = auth.uid() and m.status = 'active' and m.role in ('school_admin', 'staff')
  ) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  for r in
    select * from public.forms
    where deleted_at is null and notified_at is null
      and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at > now())
    for update skip locked
  loop
    insert into public.notifications (user_id, school_id, kind, payload)
    select m.user_id, r.school_id, 'form.new',
           jsonb_build_object('form_id', r.id, 'title', r.title, 'closes_at', r.closes_at, 'per_student', r.per_student)
    from (
      select distinct m.user_id from public.memberships m
      where m.school_id = r.school_id and m.status = 'active'
        and m.role in ('parent', 'guardian', 'teacher', 'staff', 'school_admin')
        and public.matches_audience(r.school_id, r.audience, r.target_ids, m.user_id)
    ) m
    where r.created_by is null or m.user_id <> r.created_by;
    get diagnostics n = row_count;
    total := total + n;
    update public.forms set notified_at = now() where id = r.id;
  end loop;
  return total;
end
$$;
revoke all on function public.notify_due_forms() from public, anon;
grant execute on function public.notify_due_forms() to authenticated, service_role;

-- ── preference groups ────────────────────────────────────────────────────────
create or replace function public.notification_group(kind text)
returns text
language sql immutable
as $$
  select case
    when kind like 'announcement.%' then 'announcement'
    when kind like 'document.%' or kind like 'form.%' then 'document'
    when kind like 'class_post.%' or kind like 'note.%' or kind like 'assessment.%' or kind like 'appointment.%' then 'class'
    when kind like 'message.%' then 'message'
    when kind like 'event.%' then 'event'
    when kind like 'absence.%' then 'absence'
    when kind like 'report.%' then 'moderation'
    when kind like 'community.%' then 'community'
    else 'other'
  end;
$$;

-- ── profile embeds for PostgREST ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_posts_author_profile_fkey') then
    alter table public.community_posts add constraint community_posts_author_profile_fkey
      foreign key (author_id) references public.profiles (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'form_responses_user_profile_fkey') then
    alter table public.form_responses add constraint form_responses_user_profile_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;
end
$$;

-- Contact details of a classified's author, only what they opted to share (school members).
create or replace function public.classified_contact(post uuid)
returns table (phone text, email text)
language sql stable security definer set search_path = public
as $$
  select case when o.show_phone then p.phone end, case when o.show_email then u.email::text end
  from public.community_posts cp
  join public.profiles p on p.id = cp.author_id
  join auth.users u on u.id = cp.author_id
  left join public.directory_optins o on o.user_id = cp.author_id and o.school_id = cp.school_id
  where cp.id = post and cp.status = 'published' and cp.deleted_at is null
    and public.is_school_member(cp.school_id, auth.uid());
$$;
revoke all on function public.classified_contact(uuid) from public, anon;
grant execute on function public.classified_contact(uuid) to authenticated, service_role;

-- Appointment slots with family names, for the teacher of the class and the staff only.
create or replace function public.class_appointments(class_ uuid)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, location text, booked_at timestamptz,
  booked_by uuid, parent_name text, student_id uuid, student_name text
)
language sql stable security definer set search_path = public
as $$
  select a.id, a.starts_at, a.ends_at, a.location, a.booked_at, a.booked_by,
         case when p.id is null then null else p.first_name || ' ' || p.last_name end,
         a.student_id,
         case when s.id is null then null else s.first_name || ' ' || s.last_name end
  from public.appointment_slots a
  left join public.profiles p on p.id = a.booked_by
  left join public.students s on s.id = a.student_id
  where a.class_id = class_
    and (public.is_class_teacher(class_, auth.uid()) or public.is_school_staff(a.school_id, auth.uid()))
  order by a.starts_at;
$$;
revoke all on function public.class_appointments(uuid) from public, anon;
grant execute on function public.class_appointments(uuid) to authenticated, service_role;
