-- A guardian only sees their children once their membership in the child's school is
-- active (i.e. after onboarding). Invited users who followed a magic link but have not
-- accepted the legal texts yet see nothing.
create or replace function public.guardian_student_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select sg.student_id
  from public.student_guardians sg
  join public.students s on s.id = sg.student_id
  join public.memberships m
    on m.user_id = sg.user_id and m.school_id = s.school_id
   and m.status = 'active' and m.role in ('parent', 'guardian')
  where sg.user_id = uid and not sg.access_blocked;
$$;

create or replace function public.guardian_class_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct e.class_id
  from public.student_guardians sg
  join public.students s on s.id = sg.student_id
  join public.memberships m
    on m.user_id = sg.user_id and m.school_id = s.school_id
   and m.status = 'active' and m.role in ('parent', 'guardian')
  join public.enrollments e on e.student_id = sg.student_id
  where sg.user_id = uid
    and not sg.access_blocked
    and (e.left_on is null or e.left_on >= current_date);
$$;
