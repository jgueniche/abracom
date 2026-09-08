-- Access helpers reused by every RLS policy (brief §5). All are STABLE, SECURITY DEFINER
-- (they read tables the caller may not see) and pinned to search_path = public.

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
  ) or public.is_super_admin(uid);
$$;

create or replace function public.is_school_member(school uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.school_id = school and m.status = 'active'
  ) or public.is_super_admin(uid);
$$;

-- Direction + secrétariat / vie scolaire.
create or replace function public.is_school_staff(school uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_school_role(school, array['school_admin', 'staff']::public.membership_role[], uid);
$$;

create or replace function public.is_school_admin(school uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_school_role(school, array['school_admin']::public.membership_role[], uid);
$$;

-- Schools the user belongs to (active memberships).
create or replace function public.user_school_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct m.school_id from public.memberships m
  where m.user_id = uid and m.status = 'active';
$$;

create or replace function public.is_class_teacher(class_ uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.class_teachers ct
    where ct.class_id = class_ and ct.user_id = uid
  );
$$;

-- Classes where the user teaches (any role).
create or replace function public.teacher_class_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select ct.class_id from public.class_teachers ct where ct.user_id = uid;
$$;

-- Students the user is a guardian of (blocked relationships excluded).
create or replace function public.guardian_student_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select sg.student_id from public.student_guardians sg
  where sg.user_id = uid and not sg.access_blocked;
$$;

-- Classes of the user's children (active enrollments only).
create or replace function public.guardian_class_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct e.class_id
  from public.student_guardians sg
  join public.enrollments e on e.student_id = sg.student_id
  where sg.user_id = uid
    and not sg.access_blocked
    and (e.left_on is null or e.left_on >= current_date);
$$;

create or replace function public.can_access_class(class_ uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = class_
      and (
        public.is_school_staff(c.school_id, uid)
        or public.is_class_teacher(c.id, uid)
        or c.id in (select public.guardian_class_ids(uid))
      )
  );
$$;

create or replace function public.can_access_student(student uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = student
      and (
        public.is_school_staff(s.school_id, uid)
        or s.id in (select public.guardian_student_ids(uid))
        or exists (
          select 1 from public.enrollments e
          where e.student_id = s.id
            and (e.left_on is null or e.left_on >= current_date)
            and public.is_class_teacher(e.class_id, uid)
        )
      )
  );
$$;

-- Assessments and individual notes: teachers of the class, direction, and parents
-- (membership role `parent`, not `guardian`) whose relationship allows grades.
create or replace function public.can_view_student_grades(student uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = student
      and (
        public.is_school_admin(s.school_id, uid)
        or exists (
          select 1 from public.enrollments e
          where e.student_id = s.id
            and (e.left_on is null or e.left_on >= current_date)
            and public.is_class_teacher(e.class_id, uid)
        )
        or exists (
          select 1 from public.student_guardians sg
          join public.memberships m on m.user_id = sg.user_id and m.school_id = s.school_id
          where sg.student_id = s.id and sg.user_id = uid
            and not sg.access_blocked and sg.can_view_grades
            and m.status = 'active' and m.role = 'parent'
        )
      )
  );
$$;
