-- Two consent refinements from the security review (ADR-0029 follow-up):
-- 1. contact details on a classified ad need their own opt-in (the class directory choice is not
--    reused school-wide);
-- 2. onboarding activates only the invitations the person accepted, not every pending membership.

alter table public.directory_optins add column if not exists show_on_classifieds boolean not null default false;

create or replace function public.classified_contact(post uuid)
returns table (phone text, email text)
language sql stable security definer set search_path = public
as $$
  select case when o.show_on_classifieds and o.show_phone then pc.phone end,
         case when o.show_on_classifieds and o.show_email then u.email::text end
  from public.community_posts cp
  join auth.users u on u.id = cp.author_id
  left join public.profile_contacts pc on pc.user_id = cp.author_id
  left join public.directory_optins o on o.user_id = cp.author_id and o.school_id = cp.school_id
  where cp.id = post and cp.status = 'published' and cp.deleted_at is null
    and public.is_school_member(cp.school_id, auth.uid());
$$;

drop function if exists public.activate_my_memberships();
create function public.activate_my_memberships(schools uuid[] default null)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  affected integer;
begin
  update public.memberships
     set status = 'active', accepted_at = coalesce(accepted_at, now())
   where user_id = auth.uid() and status = 'invited'
     and (schools is null or school_id = any (schools));
  get diagnostics affected = row_count;
  return affected;
end
$$;
revoke all on function public.activate_my_memberships(uuid[]) from public, anon;
grant execute on function public.activate_my_memberships(uuid[]) to authenticated, service_role;
