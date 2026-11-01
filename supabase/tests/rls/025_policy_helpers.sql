-- pgTAP : les fonctions des politiques restent en PL/pgSQL, et répondent pareil (ADR-0084).
-- Une fonction SQL appelée par une autre est replanifiée à chaque appel jusqu'à PostgreSQL 17 ;
-- c'était 1,4 ms par ligne filtrée. Une migration qui en redéfinirait une en `language sql`
-- ramènerait ce coût sans que rien ne casse : ce test le dit.
begin;
select plan(9);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

create or replace function pg_temp.owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;

\set parent1 '''c0000000-0000-4000-8000-000000010001'''

select is(
  (select array_agg(p.proname order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.prolang = (select oid from pg_language where lanname = 'sql')
      and p.proname = any (array[
        'accepts_parent_dm', 'attendance_can_manage', 'attendance_can_view_record',
        'attendance_list_students', 'attendance_student_on_list', 'can_access_class',
        'can_access_student', 'can_post_in_thread', 'can_view_profile', 'can_view_student_grades',
        'can_write_in_school', 'class_school_id', 'event_targets_valid', 'guardian_class_ids',
        'guardian_student_ids', 'has_school_role', 'is_class_teacher', 'is_enrolled',
        'is_school_admin', 'is_school_member', 'is_school_staff', 'is_super_admin',
        'is_thread_member', 'is_thread_moderator', 'matches_audience', 'may_inspect',
        'mfa_required', 'parent_can_message', 'parent_channel_open', 'student_school_id',
        'teacher_class_ids', 'teaches_student'])),
  null,
  'no policy helper is back in language sql'
);

-- Every function a policy reaches, directly or through another, is either PL/pgSQL or a SQL
-- function the planner can inline (neither SECURITY DEFINER nor configured).
select is(
  (with recursive pol as (
     select coalesce(pg_get_expr(polqual, polrelid), '') || ' ' || coalesce(pg_get_expr(polwithcheck, polrelid), '') as expr
       from pg_policy
   ),
   fns as (
     select p.oid, p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
   ),
   used (oid) as (
     select f.oid from fns f where exists (select 1 from pol where pol.expr ~ ('\m' || f.proname || '\('))
     union
     select g.oid from used u join fns f on f.oid = u.oid join fns g on f.prosrc ~ ('\m' || g.proname || '\(')
   )
   select array_agg(p.proname order by p.proname)
     from used u join pg_proc p on p.oid = u.oid
    where p.prolang = (select oid from pg_language where lanname = 'sql')
      and (p.prosecdef or p.proconfig is not null)),
  null,
  'every function a policy reaches is plpgsql or inlinable SQL'
);

select is(
  (select prosecdef and proconfig = array['search_path=public'] and provolatile = 's'
     from pg_proc where oid = 'public.can_access_class(uuid, uuid)'::regprocedure),
  true,
  'can_access_class keeps SECURITY DEFINER, STABLE and its search_path'
);

-- Same answers as before, read through the policies.
select pg_temp.login(:parent1);
select is(
  (select count(*) from public.class_posts p
    where p.class_id not in (select public.guardian_class_ids(:parent1)) and p.author_id <> :parent1),
  0::bigint,
  'a parent still reads no class post outside the classes of their children'
);
select cmp_ok(
  (select count(*) from public.class_posts where type = 'homework'), '>', 0::bigint,
  'and still reads the homework of those classes'
);
select is(
  (select count(*) from public.students s where s.id not in (select public.guardian_student_ids(:parent1))),
  0::bigint,
  'a parent reads no other child'
);
select is(public.can_access_class('00000000-0000-4000-8000-000000000514', :parent1), true,
  'can_access_class: the class of a child');
select is(
  public.can_access_class(
    (select c.id from public.classes c
      where c.id not in (select public.guardian_class_ids(:parent1)) limit 1),
    :parent1),
  false,
  'can_access_class: another class');
select pg_temp.owner();

-- A helper that reads a column named like itself.
select is(public.accepts_parent_dm(:parent1), true, 'accepts_parent_dm still reads the profile');

select * from finish();
rollback;
