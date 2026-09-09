-- QA phase (2026-09-09): two-factor authentication becomes a per-school option. RLS demands an
-- aal2 session for the direction only where `schools.modules -> 'security' ->> 'mfaRequired'` is
-- true (default false); the platform super admin is not gated. Enrolment stays available to
-- everyone, and an enrolled person must still verify their code at each session.
create or replace function public.mfa_required(school uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((s.modules -> 'security' ->> 'mfaRequired')::boolean, false)
  from public.schools s where s.id = school;
$$;
revoke all on function public.mfa_required(uuid) from public, anon;
grant execute on function public.mfa_required(uuid) to authenticated, service_role;

create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.role = 'super_admin' and m.status = 'active'
  );
$$;

create or replace function public.has_school_role(school uuid, roles public.membership_role[], uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.school_id = school and m.status = 'active' and m.role = any (roles)
      and (m.role <> 'school_admin' or not public.mfa_required(school) or public.has_strong_auth(uid))
  ) or public.is_super_admin(uid);
$$;
