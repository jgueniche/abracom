-- Helpers for the administration screens (session 5).

-- Service-role only: resolve an auth user by e-mail during CSV imports.
create or replace function public.find_user_id_by_email(email text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select u.id from auth.users u where lower(u.email) = lower(find_user_id_by_email.email) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

-- Atomically make a school year the current one (the partial unique index allows a single one).
create or replace function public.set_current_school_year(year_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  school uuid;
begin
  select school_id into school from public.school_years where id = year_id;
  if school is null then
    raise exception 'Année scolaire introuvable' using errcode = 'no_data_found';
  end if;
  if not public.is_school_admin(school, auth.uid()) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  update public.school_years set is_current = false where school_id = school and is_current;
  update public.school_years set is_current = true where id = year_id;
end
$$;
revoke all on function public.set_current_school_year(uuid) from public, anon;
grant execute on function public.set_current_school_year(uuid) to authenticated, service_role;
