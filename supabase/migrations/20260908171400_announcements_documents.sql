-- Session 6: announcement recipients / reminders, document purposes and signature side effects.

-- What a document is for; signing an image-rights document updates the student record.
create type public.document_purpose as enum ('generic', 'image_rights', 'outing_authorization', 'charter');
alter table public.documents add column purpose public.document_purpose not null default 'generic';
alter table public.announcements add column document_id uuid references public.documents (id) on delete set null;
create index announcements_document_id_idx on public.announcements (document_id);

create or replace function public.apply_document_signature()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  doc_purpose public.document_purpose;
begin
  select d.purpose into doc_purpose from public.documents d where d.id = new.document_id;
  if doc_purpose = 'image_rights' and new.student_id is not null then
    update public.students
       set image_rights_signed_at = coalesce(image_rights_signed_at, new.signed_at)
     where id = new.student_id;
  end if;
  return new;
end
$$;
create trigger document_signatures_apply after insert on public.document_signatures
  for each row execute function public.apply_document_signature();

-- Users an announcement is addressed to (active members matching its audience).
-- Staff only: used for read-receipt counters, reminders and CSV exports.
create or replace function public.announcement_recipients(announcement uuid)
returns table (user_id uuid, first_name text, last_name text, role public.membership_role, read_at timestamptz, acked_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  a public.announcements%rowtype;
begin
  select * into a from public.announcements where id = announcement;
  if a.id is null or not public.is_school_staff(a.school_id, auth.uid()) then
    return;
  end if;
  return query
    select distinct on (m.user_id)
      m.user_id, p.first_name, p.last_name, m.role, r.read_at, r.acked_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join public.announcement_reads r on r.announcement_id = a.id and r.user_id = m.user_id
    where m.school_id = a.school_id
      and m.status = 'active'
      and m.role in ('parent', 'guardian', 'teacher', 'staff', 'school_admin')
      and public.matches_audience(a.school_id, a.audience, a.target_ids, m.user_id)
    order by m.user_id, m.role;
end
$$;
revoke all on function public.announcement_recipients(uuid) from public, anon;
grant execute on function public.announcement_recipients(uuid) to authenticated, service_role;

-- One-click reminder: an in-app notification for every recipient who has not acknowledged yet.
-- (Push / e-mail delivery of pending notifications arrives in session 10.)
create or replace function public.remind_announcement(announcement uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  a public.announcements%rowtype;
  inserted integer;
begin
  select * into a from public.announcements where id = announcement;
  if a.id is null then
    raise exception 'Annonce introuvable' using errcode = 'no_data_found';
  end if;
  if not public.is_school_staff(a.school_id, auth.uid()) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  insert into public.notifications (user_id, school_id, kind, payload, channel)
  select r.user_id, a.school_id, 'announcement.reminder',
         jsonb_build_object('announcement_id', a.id, 'title', a.title), 'inapp'
  from public.announcement_recipients(a.id) r
  where (a.requires_ack and r.acked_at is null) or (not a.requires_ack and r.read_at is null);
  get diagnostics inserted = row_count;
  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  values (a.school_id, auth.uid(), 'announcement.remind', 'announcements', a.id, jsonb_build_object('notified', inserted));
  return inserted;
end
$$;
revoke all on function public.remind_announcement(uuid) from public, anon;
grant execute on function public.remind_announcement(uuid) to authenticated, service_role;

-- Missing signatures per document (staff only): recipients of the document that have not signed
-- (per family) or whose children have not been signed for (per student).
create or replace function public.document_missing_signatures(document uuid)
returns table (user_id uuid, first_name text, last_name text, student_id uuid, student_name text)
language plpgsql stable security definer set search_path = public
as $$
declare
  d public.documents%rowtype;
begin
  select * into d from public.documents where id = document;
  if d.id is null or not public.is_school_staff(d.school_id, auth.uid()) then
    return;
  end if;
  if d.signature_per_student then
    return query
      select sg.user_id, p.first_name, p.last_name, s.id, s.first_name || ' ' || s.last_name
      from public.students s
      join public.enrollments e on e.student_id = s.id and (e.left_on is null or e.left_on >= current_date)
      join public.student_guardians sg on sg.student_id = s.id and sg.is_primary and not sg.access_blocked
      join public.profiles p on p.id = sg.user_id
      where s.school_id = d.school_id and s.status = 'active'
        and public.matches_audience(d.school_id, d.audience, d.target_ids, sg.user_id)
        and not exists (
          select 1 from public.document_signatures ds
          where ds.document_id = d.id and ds.student_id = s.id
        )
      order by s.last_name, s.first_name;
  else
    return query
      select distinct m.user_id, p.first_name, p.last_name, null::uuid, null::text
      from public.memberships m
      join public.profiles p on p.id = m.user_id
      where m.school_id = d.school_id and m.status = 'active' and m.role in ('parent', 'guardian')
        and public.matches_audience(d.school_id, d.audience, d.target_ids, m.user_id)
        and not exists (
          select 1 from public.document_signatures ds
          where ds.document_id = d.id and ds.user_id = m.user_id
        )
      order by p.last_name, p.first_name;
  end if;
end
$$;
revoke all on function public.document_missing_signatures(uuid) from public, anon;
grant execute on function public.document_missing_signatures(uuid) to authenticated, service_role;
