-- Session 20, écart n° 3 — le suivi des retards.
--
-- Nothing new is collected. Two registers already hold the answer and neither
-- was ever added up: the family's own declaration (`absences.kind = 'late'`) and
-- what the pointeuse observed (`attendance_records.status = 'late'`, or an
-- arrival after the hour the list opens). The gap was arithmetic, not data.

/**
 * Late arrivals over a period, one row per pupil.
 *
 * `class_` restricts to one class — which is how a teacher reads it. Without it
 * the whole school is reported, and only the office and the direction may.
 */
create or replace function public.late_report(
  school_ uuid,
  from_ date,
  to_ date,
  class_ uuid default null
)
returns table (
  student_id uuid, first_name text, last_name text, class_id uuid, class_name text,
  declared_late bigint, observed_late bigint, last_late date
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if class_ is null then
    if not public.is_school_staff(school_) then
      raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
    end if;
  elsif not (public.is_class_teacher(class_) or public.is_school_staff(school_)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if to_ < from_ then
    raise exception 'Dates invalides' using errcode = 'check_violation';
  end if;

  return query
  with pupils as (
    select s.id, s.first_name, s.last_name, c.id as cls, c.name as cls_name
    from public.students s
    join public.enrollments e on e.student_id = s.id and e.left_on is null
    join public.classes c on c.id = e.class_id
    where s.school_id = school_ and s.status = 'active' and s.deleted_at is null
      and (class_ is null or c.id = class_)
  ),
  -- what the family told us
  declared as (
    select a.student_id, count(*) as n, max(a.starts_on) as last_on
    from public.absences a
    where a.school_id = school_ and a.kind = 'late'
      and a.starts_on between from_ and to_
    group by a.student_id
  ),
  -- what the pointeuse saw: marked late, or arrived after the list opened
  observed as (
    select r.student_id, count(*) as n, max(ses.on_date) as last_on
    from public.attendance_records r
    join public.attendance_sessions ses on ses.id = r.session_id
    join public.attendance_lists l on l.id = ses.list_id
    where r.school_id = school_
      and ses.on_date between from_ and to_
      and (
        r.status = 'late'
        or (l.opens_at is not null and r.arrived_at is not null
            and (r.arrived_at at time zone public.school_timezone(school_))::time > l.opens_at)
      )
    group by r.student_id
  )
  select p.id, p.first_name, p.last_name, p.cls, p.cls_name,
         coalesce(d.n, 0), coalesce(o.n, 0),
         greatest(d.last_on, o.last_on)
  from pupils p
  left join declared d on d.student_id = p.id
  left join observed o on o.student_id = p.id
  where coalesce(d.n, 0) + coalesce(o.n, 0) > 0
  order by coalesce(d.n, 0) + coalesce(o.n, 0) desc, p.last_name, p.first_name;
end
$$;
revoke all on function public.late_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.late_report(uuid, date, date, uuid) to authenticated, service_role;
