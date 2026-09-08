-- RGPD (session 14): self-service data export, account deletion by anonymisation, retention purge.

alter table public.profiles
  add column deletion_requested_at timestamptz,
  add column anonymized_at timestamptz;

-- Everything stored about the caller, as one JSON document (security invoker: RLS applies).
create or replace function public.export_my_data()
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'user_id', auth.uid(),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = auth.uid()),
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
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated, service_role;

-- Self-service deletion: personal data is removed or anonymised immediately; the auth account is
-- deleted by the Server Action with the service key when available. The last active admin of a
-- school must hand the role over first.
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
  delete from public.thread_members where user_id = uid;
  delete from public.event_rsvps where user_id = uid;
  delete from public.event_slot_signups where user_id = uid;
  delete from public.form_responses where user_id = uid;
  update public.messages set body = '', attachments = '[]'::jsonb, deleted_at = coalesce(deleted_at, now())
  where author_id = uid;
  update public.community_posts set status = 'archived', deleted_at = coalesce(deleted_at, now())
  where author_id = uid;
  update public.appointment_slots set booked_by = null, student_id = null, booked_at = null
  where booked_by = uid and starts_at > now();
  update public.memberships set status = 'suspended' where user_id = uid;
  update public.profiles
  set first_name = 'Compte', last_name = 'supprimé', phone = null, avatar_path = null,
      anonymized_at = now(), deletion_requested_at = coalesce(deletion_requested_at, now())
  where id = uid;
end
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated, service_role;

-- Retention (docs/RGPD.md): messages 2 years, notifications 6 months, deliveries 30 days after
-- sending, audit log 3 years, withdrawn classifieds 90 days, photos of students who left removed,
-- identity of students anonymised after the school year following their departure.
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
    'audit_log', n_audit, 'classifieds', n_classifieds, 'media', n_media, 'students', n_students
  );
end
$$;
revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
