-- Les comptes partagés de l'école test (ADR-0079).
--
-- Every account of the test school opens with the one password of the « Espace de test »
-- (ADR-0073), and the project owner hands a few of them to real parents so they can try the
-- application. Each of those accounts is shared by everyone who was given it, so any single
-- visitor could break it for all the others: change its password, turn on a second factor that
-- only their own phone answers, or delete it — and nothing would bring a deleted account back,
-- since the seed must never be replayed in production. The interface no longer offers any of
-- that on such an account; this migration makes the database hold the same line, so that it
-- holds even when the interface is bypassed (the browser holds a session that can talk to
-- Supabase Auth and to PostgREST directly).
--
--   is_test_only_account(uid)  the rule, in one place: an account of a test school and of
--                              nothing else — no real school, no platform role. The same rule
--                              set_test_school_password has always applied, now shared with it.
--   set_test_school_password   unchanged in effect; it says it is the one allowed to change
--                              those passwords (`kesher.allow_test_account_change`).
--   auth.users trigger         keeps the password and the e-mail of a shared account.
--   auth.mfa_factors trigger   refuses a second factor on a shared account.
--   delete_my_account()        refuses a shared account.
--
-- An account the school has just opened in the test school (« Nouvelle famille ») carries a
-- provisional password, and its first sign-in must still be able to replace it: nobody shares
-- that account yet, and the flow is one the direction comes to the test school to try.

-- ── La règle ─────────────────────────────────────────────────────────────────
create or replace function public.is_test_only_account(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1
             from public.memberships m
             join public.schools s on s.id = m.school_id
            where m.user_id = p_user and s.modules @> '{"test": true}'::jsonb)
     and not exists (
           select 1
             from public.memberships m
             join public.schools s on s.id = m.school_id
            where m.user_id = p_user
              and (m.role = 'super_admin' or not s.modules @> '{"test": true}'::jsonb));
$$;
-- Read by the functions and triggers below, which run as their owner; nobody needs to call it.
revoke all on function public.is_test_only_account(uuid) from public, anon, authenticated;
grant execute on function public.is_test_only_account(uuid) to service_role;

-- ── Le mot de passe de l'école test ──────────────────────────────────────────
-- The platform's way to set the one password: it says so for the length of the update, then
-- takes it back, so that nothing later in the same transaction inherits the permission.
create or replace function public.set_test_school_password(p_password text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_service_role() then
    raise exception 'service role only' using errcode = '42501';
  end if;
  if char_length(coalesce(p_password, '')) < 10 then
    raise exception 'the test password has at least 10 characters' using errcode = '22023';
  end if;

  perform set_config('kesher.allow_test_account_change', 'on', true);
  update auth.users u
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where public.is_test_only_account(u.id);
  get diagnostics v_count = row_count;
  perform set_config('kesher.allow_test_account_change', '', true);
  return v_count;
end;
$$;
revoke all on function public.set_test_school_password(text) from public, anon, authenticated;
grant execute on function public.set_test_school_password(text) to service_role;

-- ── Le mot de passe et l'adresse d'un compte partagé ─────────────────────────
-- Supabase Auth writes auth.users itself — a password changed from the browser's session, an
-- e-mail change once confirmed, a password replaced with the service key. On a shared account
-- of the test school the trigger **keeps** the password and the address instead of refusing
-- the write: a refusal would surface as an error inside Supabase Auth, and that same row is
-- written on every sign-in — a lock that misfired would close the test school to everyone,
-- where a kept password never closes it to anyone. The interface says why beforehand; this is
-- the line behind it. Allowed through:
--   · set_test_school_password, and an operator who says so in their transaction
--     (`set local kesher.allow_test_account_change = 'on'`, as scripts/ops/create-account.sql);
--   · an account whose password is provisional: just opened by the school, not yet shared, its
--     first sign-in replaces it (ADR-0075).
create or replace function public.keep_shared_test_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('kesher.allow_test_account_change', true), '') = 'on' then
    return new;
  end if;
  if not public.is_test_only_account(new.id) then
    return new;
  end if;
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(old.raw_app_meta_data ->> 'password_provisional', '') <> 'true' then
    new.encrypted_password := old.encrypted_password;
    -- A provisional mark set with the kept password would send the next visitor to choose one.
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) - 'password_provisional';
  end if;
  if new.email is distinct from old.email then
    new.email := old.email;
  end if;
  return new;
end;
$$;
revoke all on function public.keep_shared_test_account() from public, anon, authenticated;

drop trigger if exists keep_shared_test_account on auth.users;
create trigger keep_shared_test_account
  before update of encrypted_password, email on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password
        or old.email is distinct from new.email)
  execute function public.keep_shared_test_account();

-- ── La validation en deux étapes d'un compte partagé ─────────────────────────
-- A factor lives on one phone: on a shared account, every other visitor would be asked for a
-- code they cannot have. Refusing is safe here — enrolment is the only write it can stop.
create or replace function public.refuse_shared_test_account_factor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_test_only_account(new.user_id) then
    raise exception 'a shared account of the test school takes no second factor'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.refuse_shared_test_account_factor() from public, anon, authenticated;

drop trigger if exists refuse_shared_test_account_factor on auth.mfa_factors;
create trigger refuse_shared_test_account_factor
  before insert on auth.mfa_factors
  for each row
  execute function public.refuse_shared_test_account_factor();

-- ── La suppression d'un compte partagé ───────────────────────────────────────
-- Unchanged from 20260908172500_contacts.sql but for the first check. The message is the
-- reader's: the server action shows a check_violation's message as it is.
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
  if public.is_test_only_account(uid) then
    raise exception 'Ce compte de l''école test est partagé par toutes les personnes qui l''essaient : il ne peut pas être supprimé.'
      using errcode = 'check_violation';
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
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated, service_role;
