-- Les fonctions des politiques passent en PL/pgSQL : même logique, plans gardés (ADR-0084).
--
-- Every row a policy lets through costs a call to its helper — `can_access_class`,
-- `is_school_staff`, `can_access_student`… — and those helpers call one another:
-- `can_access_class` reaches `is_school_staff` → `has_school_role` → `is_super_admin`,
-- `mfa_required`, then `is_class_teacher`, then `guardian_class_ids` → `may_inspect`.
--
-- They were written in `language sql`. Up to PostgreSQL 17, a SQL function that cannot be
-- inlined (and a SECURITY DEFINER function never can) keeps its plan for the duration of the
-- calling statement only — and a SQL function called *from another SQL function* gets a fresh
-- executor state on every call of its caller, so it is parsed and planned again, every time.
-- Measured on the local stack, a parent's homework diary: 345 rows filtered by the policy of
-- `class_posts` in **539 ms**, about 1.4 ms per row, nearly all of it planning the same eight
-- nested queries over and over. Production is five to eight times slower than the local
-- machine (ADR-0067): that is the "latency on the first click" the porteur kept describing,
-- and the reason a page reading a few hundred rows took half a second of database time.
--
-- PL/pgSQL prepares each statement once per connection and reuses the plan; PostgREST keeps
-- its connections. The same filter, same rows, same answer: **55 ms**.
--
-- What changes: the language, nothing else. Each body below is the body already in place,
-- copied verbatim from the catalogue (`prosrc`) and wrapped — `return (…)` for a value,
-- `return query …` for a set. Attributes are kept as they are (STABLE, SECURITY DEFINER,
-- `search_path = public`); `create or replace` keeps each function's owner, grants and OID, so
-- the 149 policies that reference them are untouched. Two rules keep the meaning identical:
--
--   * `#variable_conflict use_column` — in a SQL function, a column wins over a parameter of
--     the same name; PL/pgSQL would raise an error instead. The SQL rule is kept.
--   * every scalar body returns at most one row (a key lookup, `exists`, `case`, a boolean
--     expression), so `return (select …)` cannot trip on a second row where SQL would have
--     silently taken the first.
--
-- `is_service_role()` and `has_strong_auth()` stay in SQL: they are neither SECURITY DEFINER
-- nor configured, so the planner inlines them into the calling statement, which is better.
--
-- A later migration that redefines one of these helpers in `language sql` would quietly bring
-- the cost back: `supabase/tests/rls/025_policy_helpers.sql` asserts the language of each.

do $$
declare
  helpers constant text[] := array[
    'accepts_parent_dm', 'attendance_can_manage', 'attendance_can_view_record',
    'attendance_list_students', 'attendance_student_on_list', 'can_access_class',
    'can_access_student', 'can_post_in_thread', 'can_view_profile', 'can_view_student_grades',
    'can_write_in_school', 'class_school_id', 'event_targets_valid', 'guardian_class_ids',
    'guardian_student_ids', 'has_school_role', 'is_class_teacher', 'is_enrolled',
    'is_school_admin', 'is_school_member', 'is_school_staff', 'is_super_admin',
    'is_thread_member', 'is_thread_moderator', 'matches_audience', 'may_inspect',
    'mfa_required', 'parent_can_message', 'parent_channel_open', 'student_school_id',
    'teacher_class_ids', 'teaches_student'
  ];
  f record;
  body text;
  config text;
  converted integer := 0;
begin
  for f in
    select p.proname, p.proretset, p.provolatile, p.prosecdef, p.proconfig, p.prosrc,
           pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (helpers)
      and p.prolang = (select oid from pg_language where lanname = 'sql')
  loop
    if f.prosrc is null or btrim(f.prosrc) = '' then
      raise exception 'public.% has a SQL-standard body; convert it by hand', f.proname;
    end if;
    body := regexp_replace(btrim(f.prosrc), ';\s*$', '');
    select coalesce(string_agg(format('set %s to %L', split_part(c, '=', 1),
                                      substr(c, length(split_part(c, '=', 1)) + 2)), ' '), '')
      into config
      from unnest(f.proconfig) as c;
    execute format(
      'create or replace function public.%I(%s) returns %s language plpgsql %s %s %s as %L',
      f.proname, f.args, f.result,
      case f.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
      case when f.prosecdef then 'security definer' else 'security invoker' end,
      config,
      case when f.proretset
        then format(E'#variable_conflict use_column\nbegin\n  return query\n  %s;\nend', body)
        else format(E'#variable_conflict use_column\nbegin\n  return (\n  %s\n  );\nend', body)
      end);
    converted := converted + 1;
  end loop;
  raise notice 'policy helpers moved to plpgsql: %', converted;
end $$;
