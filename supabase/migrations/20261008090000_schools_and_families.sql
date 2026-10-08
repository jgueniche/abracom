-- Session 34 — plusieurs écoles, une école test, des familles inscrites par l'école.
--
-- Until now the platform held one school, the demonstration one, and nothing in
-- the application could open another: a `schools` row came from the seed, and
-- the levels a class needs (TPS … CM2) from the seed too. The real school is
-- about to be filled, a second one (Levallois) may follow, and the fictitious
-- school stays as a test bench for the direction (ADR-0073, ADR-0074).
--
-- Three functions, each with one caller:
--   create_school             the platform administrator opens a school;
--   set_test_school_password  the platform administrator sets the one password
--                             of the test school's accounts (the « Espace de
--                             test » door of the sign-in page uses it);
--   create_family             the direction registers parents and children in
--                             one transaction (ADR-0075).

-- ── Ouvrir une école ─────────────────────────────────────────────────────────
-- Security definer because a school does not exist yet when it is opened: no
-- policy of its own can admit the first row of its levels or its first
-- membership. The function admits a platform administrator and no one else, and
-- gives them the direction of the new school so that it appears in their school
-- selector at once.
create or replace function public.create_school(p_name text, p_city text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_base text;
  v_slug text;
  v_suffix integer := 1;
  v_school uuid;
begin
  if v_uid is null or not public.is_super_admin(v_uid) then
    raise exception 'only a platform administrator may open a school' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'a school name has 2 to 120 characters' using errcode = '22023';
  end if;
  if v_city is not null and char_length(v_city) > 120 then
    raise exception 'a city has at most 120 characters' using errcode = '22023';
  end if;

  -- « Abravanel Levallois » → abravanel-levallois, then -2, -3… if taken.
  v_base := trim(both '-' from regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, v_name)), '[^a-z0-9]+', '-', 'g'));
  v_base := left(v_base, 56);
  if char_length(v_base) < 2 then
    v_base := 'ecole';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.schools s where s.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix;
  end loop;

  insert into public.schools (slug, name, city, timezone, locale_default, modules)
  values (
    v_slug, v_name, v_city, 'Europe/Paris', 'fr',
    '{"announcements": true, "classes": true, "messaging": true, "agenda": true, "community": true, "assessments": {"scores": false}, "directory": true, "marketplace": true}'::jsonb
  )
  returning id into v_school;

  insert into public.levels (school_id, code, label_fr, label_en, sort_order)
  values
    (v_school, 'TPS', 'Toute petite section', 'Pre-nursery', 1),
    (v_school, 'PS', 'Petite section', 'Nursery', 2),
    (v_school, 'MS', 'Moyenne section', 'Lower kindergarten', 3),
    (v_school, 'GS', 'Grande section', 'Upper kindergarten', 4),
    (v_school, 'CP', 'CP', 'Year 1', 5),
    (v_school, 'CE1', 'CE1', 'Year 2', 6),
    (v_school, 'CE2', 'CE2', 'Year 3', 7),
    (v_school, 'CM1', 'CM1', 'Year 4', 8),
    (v_school, 'CM2', 'CM2', 'Year 5', 9);

  insert into public.memberships (school_id, user_id, role, status, accepted_at)
  values (v_school, v_uid, 'school_admin', 'active', now());

  perform public.log_audit(v_school, 'school.create', 'schools', v_school,
                           jsonb_build_object('name', v_name, 'city', v_city, 'slug', v_slug));

  return v_school;
end;
$$;

revoke all on function public.create_school(text, text) from public, anon;
grant execute on function public.create_school(text, text) to authenticated;

-- ── Le mot de passe de l'école test ──────────────────────────────────────────
-- The accounts of the test school share one password: whoever knows it may
-- enter through the « Espace de test » door of the sign-in page, as one of the
-- school's characters (ADR-0073). Only an account whose every membership is in a
-- test school is touched — never a platform administrator, never someone who
-- also belongs to a real school, whatever they were added to here.
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

  update auth.users u
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where exists (
           select 1
             from public.memberships m
             join public.schools s on s.id = m.school_id
            where m.user_id = u.id and s.modules @> '{"test": true}'::jsonb)
     and not exists (
           select 1
             from public.memberships m
             join public.schools s on s.id = m.school_id
            where m.user_id = u.id
              and (m.role = 'super_admin' or not s.modules @> '{"test": true}'::jsonb));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.set_test_school_password(text) from public, anon, authenticated;
grant execute on function public.set_test_school_password(text) to service_role;

-- ── Inscrire une famille ─────────────────────────────────────────────────────
-- The parents' accounts are created first, through the auth admin API (an auth
-- user is not a table this database may write); everything else — the family,
-- the children, their classes, the links and the parents' memberships — goes in
-- one transaction, so that a refused class does not leave half a family behind.
-- Security invoker: the existing policies decide row by row, and the check below
-- only says it plainly (memberships are the direction's to grant).
create or replace function public.create_family(
  p_school uuid,
  p_family_name text,
  p_parents jsonb,
  p_children jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_family uuid;
  v_parent jsonb;
  v_child jsonb;
  v_student uuid;
  v_students uuid[] := '{}';
  v_class_id uuid;
  v_year uuid;
  v_today date := (now() at time zone 'Europe/Paris')::date;
begin
  if v_uid is null or not public.is_school_admin(p_school, v_uid) then
    raise exception 'only the direction registers a family' using errcode = '42501';
  end if;
  if jsonb_typeof(p_parents) is distinct from 'array' or jsonb_array_length(p_parents) not between 1 and 2 then
    raise exception 'a family has one or two parents' using errcode = '22023';
  end if;
  if jsonb_typeof(p_children) is distinct from 'array' or jsonb_array_length(p_children) not between 1 and 8 then
    raise exception 'a family has one to eight children' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_family_name, ''))) not between 1 and 120 then
    raise exception 'a family needs a name' using errcode = '22023';
  end if;

  insert into public.families (school_id, name)
  values (p_school, btrim(p_family_name))
  returning id into v_family;

  -- a parent of this school, invited until their first sign-in (`activate_my_memberships`)
  for v_parent in select value from jsonb_array_elements(p_parents) loop
    insert into public.memberships (school_id, user_id, role, status, invited_by, invited_at)
    values (p_school, (v_parent ->> 'user_id')::uuid, 'parent', 'invited', v_uid, now())
    on conflict (user_id, school_id, role) do nothing;
  end loop;

  for v_child in select value from jsonb_array_elements(p_children) loop
    insert into public.students (school_id, family_id, first_name, last_name, birth_date)
    values (
      p_school, v_family,
      btrim(v_child ->> 'first_name'), btrim(v_child ->> 'last_name'),
      nullif(v_child ->> 'birth_date', '')::date
    )
    returning id into v_student;
    v_students := v_students || v_student;

    v_class_id := nullif(v_child ->> 'class_id', '')::uuid;
    if v_class_id is not null then
      select c.school_year_id into v_year
        from public.classes c
        join public.school_years y on y.id = c.school_year_id and y.is_current
       where c.id = v_class_id and c.school_id = p_school and not c.archived;
      if v_year is null then
        raise exception 'the class is not one of this school''s current classes' using errcode = '22023';
      end if;
      insert into public.enrollments (student_id, class_id, school_year_id, joined_on)
      values (v_student, v_class_id, v_year, v_today);
      v_year := null;
    end if;

    for v_parent in select value from jsonb_array_elements(p_parents) loop
      insert into public.student_guardians (student_id, user_id, relation, is_primary)
      values (
        v_student,
        (v_parent ->> 'user_id')::uuid,
        coalesce(nullif(v_parent ->> 'relation', ''), 'guardian')::public.guardian_relation,
        coalesce((v_parent ->> 'is_primary')::boolean, false)
      );
    end loop;
  end loop;

  perform public.log_audit(p_school, 'family.create', 'families', v_family,
                           jsonb_build_object('parents', jsonb_array_length(p_parents),
                                              'children', jsonb_array_length(p_children)));

  return v_students;
end;
$$;

revoke all on function public.create_family(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_family(uuid, text, jsonb, jsonb) to authenticated;
