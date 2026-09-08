-- Agenda, volunteering slots, document library with signatures, dynamic forms, appointment slots.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  scope public.event_scope not null default 'school',
  target_ids uuid[] not null default '{}',
  title text not null check (char_length(title) between 1 and 200),
  description_md text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  kind public.event_kind not null default 'other',
  requires_rsvp boolean not null default false,
  capacity integer check (capacity is null or capacity > 0),
  rsvp_deadline timestamptz,
  cost_note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at is null or ends_at >= starts_at)
);
create index events_school_starts_idx on public.events (school_id, starts_at);
create index events_target_ids_idx on public.events using gin (target_ids);
create index events_created_by_idx on public.events (created_by);
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  status public.rsvp_status not null,
  guests_count smallint not null default 0 check (guests_count between 0 and 20),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_rsvps_user_id_idx on public.event_rsvps (user_id);
create index event_rsvps_student_id_idx on public.event_rsvps (student_id);
create trigger event_rsvps_set_updated_at before update on public.event_rsvps for each row execute function public.set_updated_at();

create table public.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  needed smallint not null default 1 check (needed > 0),
  sort_order smallint not null default 0
);
create index event_slots_event_id_idx on public.event_slots (event_id);

create table public.event_slot_signups (
  slot_id uuid not null references public.event_slots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (slot_id, user_id)
);
create index event_slot_signups_user_id_idx on public.event_slot_signups (user_id);

create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  sort_order smallint not null default 0,
  unique (school_id, name)
);
create index document_folders_school_id_idx on public.document_folders (school_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  folder_id uuid references public.document_folders (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description_md text,
  storage_path text not null,
  mime text not null default 'application/pdf',
  size_bytes bigint,
  audience public.audience_kind not null default 'school',
  target_ids uuid[] not null default '{}',
  requires_signature boolean not null default false,
  -- per-child signature (image rights, outing authorisation) vs per-family (charter)
  signature_per_student boolean not null default false,
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index documents_school_id_idx on public.documents (school_id, published_at desc);
create index documents_folder_id_idx on public.documents (folder_id);
create index documents_target_ids_idx on public.documents using gin (target_ids);
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();

create table public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  document_version integer not null default 1,
  signed_at timestamptz not null default now(),
  ip inet,
  user_agent text
);
create unique index document_signatures_unique_idx
  on public.document_signatures (document_id, user_id, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index document_signatures_user_id_idx on public.document_signatures (user_id);
create index document_signatures_student_id_idx on public.document_signatures (student_id);

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description_md text,
  schema jsonb not null default '{"fields": []}'::jsonb,
  audience public.audience_kind not null default 'school',
  target_ids uuid[] not null default '{}',
  per_student boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index forms_school_id_idx on public.forms (school_id);
create index forms_target_ids_idx on public.forms using gin (target_ids);
create trigger forms_set_updated_at before update on public.forms for each row execute function public.set_updated_at();

create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index form_responses_unique_idx
  on public.form_responses (form_id, user_id, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index form_responses_user_id_idx on public.form_responses (user_id);
create trigger form_responses_set_updated_at before update on public.form_responses for each row execute function public.set_updated_at();

-- Parent-teacher meetings: the teacher opens slots, a family books one.
create table public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  booked_by uuid references auth.users (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointment_slots_class_id_idx on public.appointment_slots (class_id, starts_at);
create index appointment_slots_teacher_id_idx on public.appointment_slots (teacher_id);
create index appointment_slots_booked_by_idx on public.appointment_slots (booked_by);
