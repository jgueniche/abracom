-- Official announcements, class feed, homework, assessments, individual notes, absences.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  audience public.audience_kind not null default 'school',
  -- level ids (audience = level), class ids (class) or user ids (custom)
  target_ids uuid[] not null default '{}',
  title text not null check (char_length(title) between 1 and 200),
  body_md text not null default '',
  title_en text,
  body_md_en text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  template text,
  pinned boolean not null default false,
  requires_ack boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  search tsvector generated always as (
    to_tsvector('public.french_unaccent', coalesce(title, '') || ' ' || coalesce(body_md, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index announcements_school_published_idx on public.announcements (school_id, published_at desc);
create index announcements_author_id_idx on public.announcements (author_id);
create index announcements_target_ids_idx on public.announcements using gin (target_ids);
create index announcements_search_idx on public.announcements using gin (search);
create trigger announcements_set_updated_at before update on public.announcements for each row execute function public.set_updated_at();

create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  mime text not null,
  created_at timestamptz not null default now()
);
create index announcement_attachments_announcement_id_idx on public.announcement_attachments (announcement_id);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  acked_at timestamptz,
  primary key (announcement_id, user_id)
);
create index announcement_reads_user_id_idx on public.announcement_reads (user_id);

create table public.class_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  type public.class_post_type not null default 'info',
  title text not null check (char_length(title) between 1 and 200),
  body_md text not null default '',
  subject text,
  due_on date,
  published_at timestamptz,
  visibility public.post_visibility not null default 'parents',
  search tsvector generated always as (
    to_tsvector('public.french_unaccent', coalesce(title, '') || ' ' || coalesce(body_md, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index class_posts_class_published_idx on public.class_posts (class_id, published_at desc);
create index class_posts_school_id_idx on public.class_posts (school_id);
create index class_posts_author_id_idx on public.class_posts (author_id);
create index class_posts_due_on_idx on public.class_posts (class_id, due_on) where type = 'homework';
create index class_posts_search_idx on public.class_posts using gin (search);
create trigger class_posts_set_updated_at before update on public.class_posts for each row execute function public.set_updated_at();

create table public.class_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.class_posts (id) on delete cascade,
  storage_path text not null,
  kind public.media_kind not null default 'image',
  width integer,
  height integer,
  blurhash text,
  caption text,
  consent_checked boolean not null default false,
  -- tagging requires image rights: enforced by trigger below and by server actions
  tagged_student_ids uuid[] not null default '{}',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index class_post_media_post_id_idx on public.class_post_media (post_id);

-- A student may only be tagged on a photo when their image-rights authorisation is signed.
create or replace function public.check_media_tags()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  missing text;
begin
  if array_length(new.tagged_student_ids, 1) is null then
    return new;
  end if;
  select string_agg(s.first_name || ' ' || s.last_name, ', ')
    into missing
  from public.students s
  where s.id = any (new.tagged_student_ids) and s.image_rights_signed_at is null;
  if missing is not null then
    raise exception 'Droit à l''image non signé pour : %', missing using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger class_post_media_check_tags before insert or update of tagged_student_ids on public.class_post_media
  for each row execute function public.check_media_tags();

create table public.homework_completions (
  post_id uuid not null references public.class_posts (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  marked_by_user_id uuid references auth.users (id) on delete set null,
  done_at timestamptz not null default now(),
  primary key (post_id, student_id)
);
create index homework_completions_student_id_idx on public.homework_completions (student_id);

create table public.assessment_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  sort_order smallint not null default 0,
  unique (school_year_id, label)
);
create index assessment_periods_school_id_idx on public.assessment_periods (school_id);
create index assessment_periods_school_year_id_idx on public.assessment_periods (school_year_id);

create table public.skill_catalog (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  level_id uuid not null references public.levels (id) on delete cascade,
  domain text not null,
  code text not null,
  label_fr text not null,
  label_en text not null,
  sort_order smallint not null default 0,
  unique (school_id, level_id, code)
);
create index skill_catalog_level_id_idx on public.skill_catalog (level_id);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid references auth.users (id) on delete set null,
  period_id uuid not null references public.assessment_periods (id) on delete cascade,
  skill_id uuid not null references public.skill_catalog (id) on delete cascade,
  level public.assessment_level,
  -- optional numeric score for elementary classes (enabled per school via schools.modules)
  score numeric(5, 2),
  score_scale text check (score_scale is null or score_scale in ('/10', '/20', 'A-D')),
  comment text,
  visible_to_parents boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, skill_id, period_id),
  check (level is not null or score is not null)
);
create index assessments_class_id_idx on public.assessments (class_id);
create index assessments_student_id_idx on public.assessments (student_id);
create index assessments_teacher_id_idx on public.assessments (teacher_id);
create index assessments_period_id_idx on public.assessments (period_id);
create index assessments_skill_id_idx on public.assessments (skill_id);
create trigger assessments_set_updated_at before update on public.assessments for each row execute function public.set_updated_at();

create table public.individual_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body_md text not null,
  visibility public.post_visibility not null default 'parents',
  kind public.note_kind not null default 'info',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index individual_notes_student_id_idx on public.individual_notes (student_id, created_at desc);
create index individual_notes_author_id_idx on public.individual_notes (author_id);
create trigger individual_notes_set_updated_at before update on public.individual_notes for each row execute function public.set_updated_at();

create table public.individual_note_reads (
  note_id uuid not null references public.individual_notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  declared_by uuid references auth.users (id) on delete set null,
  kind public.absence_kind not null default 'absence',
  status public.absence_status not null default 'declared',
  starts_on date not null,
  ends_on date not null,
  reason text,
  justification_path text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index absences_student_id_idx on public.absences (student_id, starts_on desc);
create index absences_school_id_idx on public.absences (school_id, starts_on desc);
create trigger absences_set_updated_at before update on public.absences for each row execute function public.set_updated_at();
