-- Threads (DM, class group, official class channel, event), messages, reactions, reports.

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.thread_kind not null,
  class_id uuid references public.classes (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  title text,
  created_by uuid references auth.users (id) on delete set null,
  allow_replies boolean not null default true,
  locked boolean not null default false,
  archived boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind not in ('class_group', 'class_official') or class_id is not null),
  check (kind <> 'event' or event_id is not null)
);
create index threads_school_id_idx on public.threads (school_id, last_message_at desc nulls last);
create index threads_class_id_idx on public.threads (class_id);
create index threads_event_id_idx on public.threads (event_id);
create index threads_created_by_idx on public.threads (created_by);
create trigger threads_set_updated_at before update on public.threads for each row execute function public.set_updated_at();

create table public.thread_members (
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.thread_member_role not null default 'member',
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);
create index thread_members_user_id_idx on public.thread_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  reply_to uuid references public.messages (id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  moderation_reason text,
  search tsvector generated always as (to_tsvector('public.french_unaccent', coalesce(body, ''))) stored,
  created_at timestamptz not null default now(),
  check (char_length(body) <= 5000)
);
create index messages_thread_created_idx on public.messages (thread_id, created_at desc);
create index messages_author_id_idx on public.messages (author_id);
create index messages_reply_to_idx on public.messages (reply_to);
create index messages_search_idx on public.messages using gin (search);

-- keep threads.last_message_at fresh
create or replace function public.touch_thread_last_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end
$$;
create trigger messages_touch_thread after insert on public.messages for each row execute function public.touch_thread_last_message();

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index message_reactions_user_id_idx on public.message_reactions (user_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason text not null,
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
create index reports_school_status_idx on public.reports (school_id, status);
create index reports_message_id_idx on public.reports (message_id);
create index reports_reporter_id_idx on public.reports (reporter_id);
