-- Called at the end of onboarding: turns the caller's invited memberships into active ones.
-- SECURITY DEFINER so a user can flip their own status without an update policy on
-- memberships (which would let them touch other columns such as role).
create or replace function public.activate_my_memberships()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  affected integer;
begin
  update public.memberships
     set status = 'active', accepted_at = coalesce(accepted_at, now())
   where user_id = auth.uid() and status = 'invited';
  get diagnostics affected = row_count;
  return affected;
end
$$;

revoke all on function public.activate_my_memberships() from public;
grant execute on function public.activate_my_memberships() to authenticated;
