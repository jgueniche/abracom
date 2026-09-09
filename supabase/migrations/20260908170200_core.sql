-- Core: schools, years, profiles, memberships, levels, classes, students, families, guardians.
-- Every table carries school_id (multi-school from day one) and is protected by RLS (see 20260908170800_rls.sql).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null,
  city text,
  address text,
  timezone text not null default 'Europe/Paris',
  locale_default text not null default 'fr' check (locale_default in ('fr', 'en')),
  modules jsonb not null default '{}'::jsonb,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger schools_set_updated_at before update on public.schools for each row execute function public.set_updated_at();

create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, label)
);
create index school_years_school_id_idx on public.school_years (school_id);
-- exactly one current year per school
create unique index school_years_one_current_idx on public.school_years (school_id) where is_current;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  avatar_path text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  show_hebrew_date boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Create the profile row as soon as Supabase Auth creates the user (invitation or magic link).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, locale, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    case when new.raw_user_meta_data ->> 'locale' in ('fr', 'en') then new.raw_user_meta_data ->> 'locale' else 'fr' end,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'invited',
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, school_id, role)
);
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_school_id_role_idx on public.memberships (school_id, role);
create trigger memberships_set_updated_at before update on public.memberships for each row execute function public.set_updated_at();

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code public.level_code not null,
  label_fr text not null,
  label_en text not null,
  sort_order smallint not null,
  unique (school_id, code)
);
create index levels_school_id_idx on public.levels (school_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  level_id uuid not null references public.levels (id) on delete restrict,
  name text not null,
  room text,
  capacity smallint check (capacity is null or capacity > 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, name)
);
create index classes_school_id_idx on public.classes (school_id);
create index classes_school_year_id_idx on public.classes (school_year_id);
create index classes_level_id_idx on public.classes (level_id);
create trigger classes_set_updated_at before update on public.classes for each row execute function public.set_updated_at();

create table public.class_teachers (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.class_teacher_role not null default 'main',
  subject text,
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_teachers_user_id_idx on public.class_teachers (user_id);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index families_school_id_idx on public.families (school_id);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  family_id uuid references public.families (id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  photo_path text,
  allergies_note text,
  image_rights_signed_at timestamptz,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index students_school_id_idx on public.students (school_id);
create index students_family_id_idx on public.students (family_id);
create trigger students_set_updated_at before update on public.students for each row execute function public.set_updated_at();

-- Admin-only notes (kept apart from students so RLS can protect them fully).
create table public.student_private_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index student_private_notes_student_id_idx on public.student_private_notes (student_id);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  joined_on date not null default current_date,
  left_on date check (left_on is null or left_on >= joined_on),
  created_at timestamptz not null default now(),
  unique (student_id, class_id)
);
create index enrollments_class_id_idx on public.enrollments (class_id);
create index enrollments_student_id_idx on public.enrollments (student_id);
create index enrollments_school_year_id_idx on public.enrollments (school_year_id);

create table public.student_guardians (
  student_id uuid not null references public.students (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  relation public.guardian_relation not null default 'guardian',
  is_primary boolean not null default false,
  can_view_grades boolean not null default true,
  can_message boolean not null default true,
  receives_notifications boolean not null default true,
  -- "restriction judiciaire": hides the child from this guardian entirely (admin only, audited)
  access_blocked boolean not null default false,
  access_blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, user_id)
);
create index student_guardians_user_id_idx on public.student_guardians (user_id);
create trigger student_guardians_set_updated_at before update on public.student_guardians for each row execute function public.set_updated_at();
