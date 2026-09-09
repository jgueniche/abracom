-- Personal contact data out of the shared profile (ADR-0029): the phone number moves to
-- profile_contacts (self, school staff, teachers of the child), the court-restriction reason moves
-- to guardian_restrictions (direction only). Thread co-members may see each other's names.

-- ── phone numbers ────────────────────────────────────────────────────────────
create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  updated_at timestamptz not null default now()
);
create trigger profile_contacts_set_updated_at before update on public.profile_contacts
  for each row execute function public.set_updated_at();
insert into public.profile_contacts (user_id, phone)
select id, phone from public.profiles where phone is not null;
alter table public.profiles drop column phone;

alter table public.profile_contacts enable row level security;
create policy profile_contacts_select on public.profile_contacts for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = profile_contacts.user_id and tm.status = 'active'
        and public.is_school_staff(tm.school_id, (select auth.uid()))
    )
    or exists (
      select 1 from public.student_guardians sg
      join public.enrollments e on e.student_id = sg.student_id
      where sg.user_id = profile_contacts.user_id
        and (e.left_on is null or e.left_on >= current_date)
        and public.is_class_teacher(e.class_id, (select auth.uid()))
    )
  );
create policy profile_contacts_write on public.profile_contacts for all to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = profile_contacts.user_id and public.is_school_admin(tm.school_id, (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = profile_contacts.user_id and public.is_school_admin(tm.school_id, (select auth.uid()))
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    case when new.raw_user_meta_data ->> 'locale' in ('fr', 'en') then new.raw_user_meta_data ->> 'locale' else 'fr' end
  )
  on conflict (id) do nothing;
  if new.phone is not null then
    insert into public.profile_contacts (user_id, phone) values (new.id, new.phone)
    on conflict (user_id) do update set phone = excluded.phone;
  end if;
  return new;
end
$$;

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
      case when o.show_phone then pc.phone end as phone,
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
    left join public.profile_contacts pc on pc.user_id = sg.user_id
    join public.directory_optins o on o.user_id = sg.user_id and o.school_id = c.school_id
    where e.class_id = class_ and (e.left_on is null or e.left_on >= current_date)
      and public.can_access_class(class_, auth.uid())
      and (o.show_phone or o.show_email or o.show_children_names or o.show_address)
    order by sg.user_id, sg.is_primary desc
  ) d
  order by d.last_name, d.first_name;
$$;

create or replace function public.classified_contact(post uuid)
returns table (phone text, email text)
language sql stable security definer set search_path = public
as $$
  select case when o.show_phone then pc.phone end, case when o.show_email then u.email::text end
  from public.community_posts cp
  join auth.users u on u.id = cp.author_id
  left join public.profile_contacts pc on pc.user_id = cp.author_id
  left join public.directory_optins o on o.user_id = cp.author_id and o.school_id = cp.school_id
  where cp.id = post and cp.status = 'published' and cp.deleted_at is null
    and public.is_school_member(cp.school_id, auth.uid());
$$;

-- Names are visible to people who share a conversation; the directory branch requires a
-- shared field.
create or replace function public.can_view_profile(target uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select target = uid
    or public.is_super_admin(uid)
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = target and tm.status = 'active' and public.is_school_staff(tm.school_id, uid)
    )
    or exists (
      select 1 from public.memberships tm
      where tm.user_id = target and tm.status = 'active'
        and tm.role in ('school_admin', 'staff', 'teacher')
        and public.is_school_member(tm.school_id, uid)
    )
    or exists (
      select 1 from public.student_guardians sg
      join public.enrollments e on e.student_id = sg.student_id
      where sg.user_id = target
        and (e.left_on is null or e.left_on >= current_date)
        and public.is_class_teacher(e.class_id, uid)
    )
    or exists (
      select 1 from public.thread_members a
      join public.thread_members b on b.thread_id = a.thread_id
      where a.user_id = uid and b.user_id = target
    )
    or exists (
      select 1 from public.directory_optins d
      join public.student_guardians sg on sg.user_id = d.user_id and not sg.access_blocked
      join public.enrollments e on e.student_id = sg.student_id
      where d.user_id = target
        and (d.show_phone or d.show_email or d.show_children_names or d.show_address)
        and (e.left_on is null or e.left_on >= current_date)
        and e.class_id in (select public.guardian_class_ids(uid))
    );
$$;

-- ── court-restriction reasons ────────────────────────────────────────────────
create table public.guardian_restrictions (
  student_id uuid not null,
  user_id uuid not null,
  reason text not null,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, user_id),
  foreign key (student_id, user_id) references public.student_guardians (student_id, user_id) on delete cascade
);
create trigger guardian_restrictions_set_updated_at before update on public.guardian_restrictions
  for each row execute function public.set_updated_at();
insert into public.guardian_restrictions (student_id, user_id, reason)
select student_id, user_id, access_blocked_reason from public.student_guardians
where access_blocked_reason is not null;
alter table public.student_guardians drop column access_blocked_reason;

alter table public.guardian_restrictions enable row level security;
create policy guardian_restrictions_admin on public.guardian_restrictions for all to authenticated
  using (public.is_school_admin(public.student_school_id(student_id), (select auth.uid())))
  with check (public.is_school_admin(public.student_school_id(student_id), (select auth.uid())));

-- ── birthdays: opt-in by a non-blocked parent ────────────────────────────────
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
        join public.memberships m on m.user_id = sg.user_id and m.school_id = s.school_id
          and m.status = 'active' and m.role = 'parent'
        join public.directory_optins o on o.user_id = sg.user_id and o.school_id = s.school_id
        where sg.student_id = s.id and not sg.access_blocked and o.show_birthday
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
        join public.memberships m on m.user_id = sg.user_id and m.school_id = s.school_id
          and m.status = 'active' and m.role = 'parent'
        join public.directory_optins o on o.user_id = sg.user_id and o.school_id = s.school_id
        where sg.student_id = s.id and not sg.access_blocked and o.show_birthday
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

-- ── data export / deletion ───────────────────────────────────────────────────
create or replace function public.export_my_data()
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'user_id', auth.uid(),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = auth.uid()),
    'contact', (select jsonb_build_object('phone', c.phone) from public.profile_contacts c where c.user_id = auth.uid()),
    'memberships', (
      select coalesce(jsonb_agg(jsonb_build_object('school_id', m.school_id, 'role', m.role, 'status', m.status, 'created_at', m.created_at)), '[]'::jsonb)
      from public.memberships m where m.user_id = auth.uid()
    ),
    'children', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'student_id', sg.student_id, 'first_name', s.first_name, 'last_name', s.last_name, 'birth_date', s.birth_date,
        'relation', sg.relation, 'is_primary', sg.is_primary, 'can_view_grades', sg.can_view_grades, 'can_message', sg.can_message
      )), '[]'::jsonb)
      from public.student_guardians sg join public.students s on s.id = sg.student_id where sg.user_id = auth.uid()
    ),
    'legal_acceptances', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.legal_acceptances l where l.user_id = auth.uid()),
    'directory', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.directory_optins d where d.user_id = auth.uid()),
    'notification_preferences', (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from public.notification_preferences n where n.user_id = auth.uid()),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object('thread_id', m.thread_id, 'body', m.body, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
      from public.messages m where m.author_id = auth.uid() and m.deleted_at is null
    ),
    'event_answers', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.event_rsvps r where r.user_id = auth.uid()),
    'form_responses', (
      select coalesce(jsonb_agg(jsonb_build_object('form_id', f.form_id, 'student_id', f.student_id, 'answers', f.answers, 'submitted_at', f.submitted_at)), '[]'::jsonb)
      from public.form_responses f where f.user_id = auth.uid()
    ),
    'classifieds', (
      select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'body', c.body, 'category', c.category, 'status', c.status, 'created_at', c.created_at)), '[]'::jsonb)
      from public.community_posts c where c.author_id = auth.uid()
    ),
    'absences_declared', (
      select coalesce(jsonb_agg(jsonb_build_object('student_id', a.student_id, 'kind', a.kind, 'status', a.status, 'starts_on', a.starts_on, 'ends_on', a.ends_on, 'reason', a.reason)), '[]'::jsonb)
      from public.absences a where a.declared_by = auth.uid()
    ),
    'appointments', (
      select coalesce(jsonb_agg(jsonb_build_object('class_id', s.class_id, 'starts_at', s.starts_at, 'student_id', s.student_id)), '[]'::jsonb)
      from public.appointment_slots s where s.booked_by = auth.uid()
    ),
    'notifications', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', n.kind, 'payload', n.payload, 'created_at', n.created_at, 'read_at', n.read_at) order by n.created_at desc), '[]'::jsonb)
      from public.notifications n where n.user_id = auth.uid()
    )
  );
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s record;
begin
  if uid is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  for s in
    select m.school_id from public.memberships m
    where m.user_id = uid and m.role = 'school_admin' and m.status = 'active'
  loop
    if not exists (
      select 1 from public.memberships m2
      where m2.school_id = s.school_id and m2.role = 'school_admin' and m2.status = 'active' and m2.user_id <> uid
    ) then
      raise exception 'Vous êtes le dernier administrateur de l''école : transférez ce rôle avant de supprimer votre compte'
        using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  select m.school_id, uid, 'account.delete', 'profiles', uid, jsonb_build_object('self_service', true)
  from public.memberships m where m.user_id = uid;

  delete from public.push_subscriptions where user_id = uid;
  delete from public.directory_optins where user_id = uid;
  delete from public.calendar_feeds where user_id = uid;
  delete from public.notification_preferences where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.student_guardians where user_id = uid;
  delete from public.class_teachers where user_id = uid;
  delete from public.thread_members where user_id = uid;
  delete from public.event_rsvps where user_id = uid;
  delete from public.event_slot_signups where user_id = uid;
  delete from public.form_responses where user_id = uid;
  delete from public.profile_contacts where user_id = uid;
  update public.messages set body = '', attachments = '[]'::jsonb, deleted_at = coalesce(deleted_at, now())
  where author_id = uid;
  update public.community_posts set status = 'archived', deleted_at = coalesce(deleted_at, now())
  where author_id = uid;
  update public.appointment_slots set booked_by = null, student_id = null, booked_at = null
  where booked_by = uid and starts_at > now();
  update public.memberships set status = 'suspended' where user_id = uid;
  update public.profiles
  set first_name = 'Compte', last_name = 'supprimé', avatar_path = null,
      anonymized_at = now(), deletion_requested_at = coalesce(deletion_requested_at, now())
  where id = uid;
end
$$;

-- ── one open enrollment per pupil and year ───────────────────────────────────
create unique index if not exists enrollments_one_open_per_year_idx
  on public.enrollments (student_id, school_year_id) where left_on is null;

-- ── function privileges ──────────────────────────────────────────────────────
-- Nothing in `public` is callable anonymously except the token-authenticated calendar feed;
-- helpers that relied on the implicit PUBLIC grant are granted to authenticated explicitly.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proacl is null
  loop
    execute format('grant execute on function %s to authenticated, service_role', f.signature);
  end loop;
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
  end loop;
end
$$;
grant execute on function public.calendar_feed(text), public.calendar_feed_events(text) to anon;
alter default privileges in schema public revoke execute on functions from public, anon;
