-- Session 32 — les menus de la semaine.
--
-- What the children eat at the canteen, week by week: written by the office
-- (direction or secretariat), read by every member of the school — parents,
-- read-only guardians, teachers. The model is the smallest one that answers the
-- question a family asks on a Sunday evening: one row per school and per week,
-- named by its Monday, and under it one row per school day with the courses as
-- short free text. No PDF attachment: a menu is typed, and then it reads on a
-- phone, is searchable one day, and costs nothing to store.

create table if not exists public.weekly_menus (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  -- The Monday that names the week (ISO weekday 1). One menu per school and
  -- per week: the unique constraint is what lets the office save the same
  -- week twice and get an update, never a duplicate.
  week_start date not null check (extract(isodow from week_start) = 1),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, week_start)
);
drop trigger if exists weekly_menus_set_updated_at on public.weekly_menus;
create trigger weekly_menus_set_updated_at before update on public.weekly_menus
  for each row execute function public.set_updated_at();
drop trigger if exists weekly_menus_freeze on public.weekly_menus;
create trigger weekly_menus_freeze before update on public.weekly_menus
  for each row execute function public.freeze_columns('school_id');

create table if not exists public.weekly_menu_days (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.weekly_menus (id) on delete cascade,
  -- 1 = Monday … 5 = Friday. The canteen does not open on the weekend, and a
  -- school that serves lunch on a Sunday is a different school (schema-wise
  -- too: the check moves, nothing else).
  day smallint not null check (day between 1 and 5),
  starter text check (starter is null or char_length(starter) between 1 and 120),
  main_course text check (main_course is null or char_length(main_course) between 1 and 120),
  side text check (side is null or char_length(side) between 1 and 120),
  dessert text check (dessert is null or char_length(dessert) between 1 and 120),
  snack text check (snack is null or char_length(snack) between 1 and 120),
  -- "sans gluten disponible", "menu de fête", "pique-nique de la sortie"
  note text check (note is null or char_length(note) between 1 and 200),
  unique (menu_id, day)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Read: every active member of the school, the read-only guardian included — a
-- menu is exactly the kind of thing they are entitled to. Write: the office
-- alone, like announcements. A teacher reads, and never writes.
alter table public.weekly_menus enable row level security;
drop policy if exists weekly_menus_select on public.weekly_menus;
create policy weekly_menus_select on public.weekly_menus for select to authenticated
  using (public.is_school_member(school_id, (select auth.uid())));
drop policy if exists weekly_menus_write on public.weekly_menus;
create policy weekly_menus_write on public.weekly_menus for all to authenticated
  using (public.is_school_staff(school_id, (select auth.uid())))
  with check (public.is_school_staff(school_id, (select auth.uid())));

-- A day is visible when its week is, and writable when its week is: the
-- policies of the parent row decide, through the visibility of the parent.
alter table public.weekly_menu_days enable row level security;
drop policy if exists weekly_menu_days_select on public.weekly_menu_days;
create policy weekly_menu_days_select on public.weekly_menu_days for select to authenticated
  using (exists (select 1 from public.weekly_menus m where m.id = menu_id));
drop policy if exists weekly_menu_days_write on public.weekly_menu_days;
create policy weekly_menu_days_write on public.weekly_menu_days for all to authenticated
  using (exists (
    select 1 from public.weekly_menus m
    where m.id = menu_id and public.is_school_staff(m.school_id, (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.weekly_menus m
    where m.id = menu_id and public.is_school_staff(m.school_id, (select auth.uid()))
  ));

-- ── save_weekly_menu ────────────────────────────────────────────────────────
-- The week and its five days in one transaction. `days_` is a JSON array of
-- objects `{day, starter, main_course, side, dessert, snack, note}`; blank
-- strings become null, a day left entirely blank is dropped, and a week with
-- nothing on any day is refused rather than published empty. Security
-- **invoker**: the policies above decide who may call it — a parent gets the
-- same 42501 as on a bare insert.
create or replace function public.save_weekly_menu(school_ uuid, week_start_ date, days_ jsonb)
returns uuid
language plpgsql set search_path = public
as $$
declare
  menu uuid;
  d jsonb;
begin
  if days_ is null or jsonb_typeof(days_) <> 'array' then
    raise exception 'days_ must be a JSON array' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.weekly_menus (school_id, week_start, created_by)
  values (school_, week_start_, auth.uid())
  on conflict (school_id, week_start) do update set updated_at = now()
  returning id into menu;

  for d in select value from jsonb_array_elements(days_) loop
    insert into public.weekly_menu_days (menu_id, day, starter, main_course, side, dessert, snack, note)
    values (
      menu,
      (d ->> 'day')::smallint,
      nullif(btrim(d ->> 'starter'), ''),
      nullif(btrim(d ->> 'main_course'), ''),
      nullif(btrim(d ->> 'side'), ''),
      nullif(btrim(d ->> 'dessert'), ''),
      nullif(btrim(d ->> 'snack'), ''),
      nullif(btrim(d ->> 'note'), '')
    )
    on conflict (menu_id, day) do update set
      starter = excluded.starter,
      main_course = excluded.main_course,
      side = excluded.side,
      dessert = excluded.dessert,
      snack = excluded.snack,
      note = excluded.note;
  end loop;

  delete from public.weekly_menu_days
  where menu_id = menu
    and starter is null and main_course is null and side is null
    and dessert is null and snack is null and note is null;

  if not exists (select 1 from public.weekly_menu_days where menu_id = menu) then
    raise exception 'a weekly menu needs at least one course on one day'
      using errcode = 'check_violation';
  end if;

  return menu;
end
$$;
revoke all on function public.save_weekly_menu(uuid, date, jsonb) from public, anon;
grant execute on function public.save_weekly_menu(uuid, date, jsonb) to authenticated, service_role;
