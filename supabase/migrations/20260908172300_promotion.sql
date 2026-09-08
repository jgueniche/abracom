-- Level promotion (session 15, brief §7.9): close the current school year and move every active
-- student to the next level in one transaction; the previous year stays readable (archived classes).

create or replace function public.next_level_id(level uuid)
returns uuid
language sql stable set search_path = public
as $$
  select n.id
  from public.levels l
  join public.levels n on n.school_id = l.school_id and n.sort_order > l.sort_order
  where l.id = level
  order by n.sort_order
  limit 1;
$$;
grant execute on function public.next_level_id(uuid) to authenticated, service_role;

-- mapping: [{"class_id": uuid, "target_level_id": uuid | null, "name": text}] — a null target means
-- the students leave the school (end of the last level offered).
create or replace function public.promote_school_year(current_year uuid, next_year uuid, mapping jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cy public.school_years%rowtype;
  ny public.school_years%rowtype;
  item jsonb;
  src public.classes%rowtype;
  target_level uuid;
  new_name text;
  new_class uuid;
  moved integer;
  n_classes integer := 0;
  n_students integer := 0;
  n_left integer := 0;
begin
  select * into cy from public.school_years where id = current_year;
  select * into ny from public.school_years where id = next_year;
  if cy.id is null or ny.id is null or cy.school_id <> ny.school_id then
    raise exception 'Années scolaires invalides' using errcode = 'no_data_found';
  end if;
  if not public.is_school_admin(cy.school_id, auth.uid()) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if ny.starts_on <= cy.starts_on then
    raise exception 'L''année cible doit suivre l''année courante' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(mapping) <> 'array' then
    raise exception 'Correspondance des classes invalide' using errcode = 'check_violation';
  end if;

  for item in select * from jsonb_array_elements(mapping) loop
    select * into src from public.classes
    where id = (item ->> 'class_id')::uuid and school_year_id = cy.id and school_id = cy.school_id;
    if src.id is null then
      continue;
    end if;
    target_level := nullif(item ->> 'target_level_id', '')::uuid;
    if target_level is null then
      update public.students s set status = 'left'
      where s.status = 'active'
        and s.id in (select e.student_id from public.enrollments e where e.class_id = src.id and e.left_on is null);
      get diagnostics moved = row_count;
      n_left := n_left + moved;
    else
      if not exists (select 1 from public.levels l where l.id = target_level and l.school_id = cy.school_id) then
        raise exception 'Niveau cible invalide' using errcode = 'check_violation';
      end if;
      new_name := coalesce(nullif(trim(item ->> 'name'), ''), src.name);
      insert into public.classes (school_id, school_year_id, level_id, name, room, capacity)
      values (cy.school_id, ny.id, target_level, new_name, src.room, src.capacity)
      on conflict (school_year_id, name) do update set level_id = excluded.level_id
      returning id into new_class;
      n_classes := n_classes + 1;
      insert into public.enrollments (student_id, class_id, school_year_id, joined_on)
      select e.student_id, new_class, ny.id, ny.starts_on
      from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.class_id = src.id and e.left_on is null and s.status = 'active'
      on conflict (student_id, class_id) do nothing;
      get diagnostics moved = row_count;
      n_students := n_students + moved;
    end if;
    update public.enrollments set left_on = cy.ends_on where class_id = src.id and left_on is null;
    update public.classes set archived = true where id = src.id;
  end loop;

  update public.school_years set is_current = false where school_id = cy.school_id and is_current;
  update public.school_years set is_current = true where id = ny.id;

  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  values (cy.school_id, auth.uid(), 'school_year.promote', 'school_years', ny.id,
          jsonb_build_object('from', cy.label, 'to', ny.label, 'classes', n_classes, 'students', n_students, 'left', n_left));
  return jsonb_build_object('classes', n_classes, 'students', n_students, 'left', n_left);
end
$$;
revoke all on function public.promote_school_year(uuid, uuid, jsonb) from public, anon;
grant execute on function public.promote_school_year(uuid, uuid, jsonb) to authenticated, service_role;
