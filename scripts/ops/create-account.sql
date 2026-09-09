-- Creates (or updates) a sign-in account with a password and school roles — ADR-0028.
-- Meant for the first administrator and demonstration accounts; families are invited
-- from the administration area (magic link) and never need a password.
--
-- Usage with psql (connection string from the Supabase dashboard, never committed):
--   psql "$DATABASE_URL" \
--     -v email='direction@example.org' -v password='…' \
--     -v first_name='Prénom' -v last_name='Nom' \
--     -v roles='school_admin' -v school='abravanel-neuilly' \
--     -f scripts/ops/create-account.sql
-- `roles` is a comma-separated list of membership roles (super_admin, school_admin, staff,
-- teacher, parent, guardian). The same block can be pasted in the SQL editor after replacing
-- the `set_config` values.
select set_config('ops.email', :'email', false),
       set_config('ops.password', :'password', false),
       set_config('ops.first_name', :'first_name', false),
       set_config('ops.last_name', :'last_name', false),
       set_config('ops.roles', :'roles', false),
       set_config('ops.school', :'school', false);

do $$
declare
  v_email text := lower(trim(current_setting('ops.email')));
  v_password text := current_setting('ops.password');
  v_first text := current_setting('ops.first_name');
  v_last text := current_setting('ops.last_name');
  v_roles text[] := string_to_array(replace(current_setting('ops.roles'), ' ', ''), ',');
  v_school uuid;
  v_user uuid;
  v_role text;
begin
  if length(v_password) < 6 then
    raise exception 'password policy: 6 characters minimum (supabase/config.toml)';
  end if;
  select id into v_school from public.schools where slug = current_setting('ops.school');
  if v_school is null then
    raise exception 'unknown school slug %', current_setting('ops.school');
  end if;

  select id into v_user from auth.users where email = v_email and is_sso_user = false;
  if v_user is null then
    v_user := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('first_name', v_first, 'last_name', v_last, 'locale', 'fr'),
      now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_user,
      jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true),
      'email', v_user::text, now(), now(), now()
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_user;
  end if;

  -- the on_auth_user_created trigger created the profile; fill the names when they are empty
  update public.profiles
  set first_name = case when first_name = '' then v_first else first_name end,
      last_name = case when last_name = '' then v_last else last_name end
  where id = v_user;

  foreach v_role in array v_roles loop
    insert into public.memberships (user_id, school_id, role, status, accepted_at)
    values (v_user, v_school, v_role::public.membership_role, 'active', now())
    on conflict (user_id, school_id, role)
    do update set status = 'active', accepted_at = coalesce(public.memberships.accepted_at, now());
  end loop;

  raise notice 'account % ready (%), roles %', v_email, v_user, v_roles;
end
$$;
