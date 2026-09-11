-- Session 20, écart n° 1 — l'emploi du temps de la classe.
--
-- One of the three reasons a family keeps Educartable open beside Kesher. The
-- model is deliberately small: a weekly grid, not a scheduling engine. A slot is
-- a day of the week, a start and an end, a subject, optionally who teaches it
-- and where. Exceptions (a swapped lesson, a trip) belong to the agenda, which
-- already exists; this table answers "what does Tuesday look like".

create table if not exists public.class_timetable (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  -- ISO weekday: 1 = Monday … 7 = Sunday. Sunday is a school day in Israel but
  -- not in Neuilly; the column allows it rather than deciding for the school.
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  subject text not null check (char_length(subject) between 1 and 80),
  teacher_id uuid references auth.users (id) on delete set null,
  room text check (room is null or char_length(room) <= 60),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists class_timetable_class_idx
  on public.class_timetable (class_id, weekday, starts_at);
create index if not exists class_timetable_teacher_idx on public.class_timetable (teacher_id);
drop trigger if exists class_timetable_set_updated_at on public.class_timetable;
create trigger class_timetable_set_updated_at before update on public.class_timetable
  for each row execute function public.set_updated_at();

-- Mirrors the profile foreign keys of 20260908171000 so the Data API can embed
-- the teacher of a slot.
alter table public.class_timetable drop constraint if exists class_timetable_teacher_profile_fkey;
alter table public.class_timetable add constraint class_timetable_teacher_profile_fkey
  foreign key (teacher_id) references public.profiles (id) on delete set null;

-- The columns that say which school and which class are not editable afterwards.
drop trigger if exists class_timetable_freeze on public.class_timetable;
create trigger class_timetable_freeze before update on public.class_timetable
  for each row execute function public.freeze_columns('school_id', 'class_id');

alter table public.class_timetable enable row level security;
-- Anyone who may open the class space reads it: the families of the class, its
-- team, the office. A read-only guardian included — a timetable is exactly the
-- kind of thing they are entitled to.
drop policy if exists class_timetable_select on public.class_timetable;
create policy class_timetable_select on public.class_timetable for select to authenticated
  using (public.can_access_class(class_id, (select auth.uid())));
drop policy if exists class_timetable_write on public.class_timetable;
create policy class_timetable_write on public.class_timetable for all to authenticated
  using (
    public.is_class_teacher(class_id, (select auth.uid()))
    or public.is_school_staff(school_id, (select auth.uid()))
  )
  with check (
    (public.is_class_teacher(class_id, (select auth.uid()))
     or public.is_school_staff(school_id, (select auth.uid())))
    and school_id = public.class_school_id(class_id)
    -- a slot may only name someone who actually teaches this class
    and (teacher_id is null or public.is_class_teacher(class_id, teacher_id))
  );

/** The week of a class, ordered as it is read: day, then hour. */
create or replace function public.class_week(class_ uuid)
returns table (
  id uuid, weekday smallint, starts_at time, ends_at time,
  subject text, room text, note text, teacher_id uuid, teacher_name text
)
language sql stable security definer set search_path = public
as $$
  select t.id, t.weekday, t.starts_at, t.ends_at, t.subject, t.room, t.note, t.teacher_id,
         case when t.teacher_id is null then null
              else (select p.first_name || ' ' || p.last_name from public.profiles p where p.id = t.teacher_id)
         end
  from public.class_timetable t
  where t.class_id = class_ and public.can_access_class(class_)
  order by t.weekday, t.starts_at, t.subject;
$$;
revoke all on function public.class_week(uuid) from public, anon;
grant execute on function public.class_week(uuid) to authenticated, service_role;
