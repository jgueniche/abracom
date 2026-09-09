-- Directory opt-in, community posts, notifications, push subscriptions, legal texts, audit log.

create table public.directory_optins (
  user_id uuid not null references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  show_phone boolean not null default false,
  show_email boolean not null default false,
  show_children_names boolean not null default false,
  show_address boolean not null default false,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, school_id)
);
create index directory_optins_school_id_idx on public.directory_optins (school_id);
create trigger directory_optins_set_updated_at before update on public.directory_optins for each row execute function public.set_updated_at();

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  category public.community_category not null default 'other',
  author_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 5000),
  status public.community_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '30 days'),
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  search tsvector generated always as (
    to_tsvector('public.french_unaccent', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index community_posts_school_status_idx on public.community_posts (school_id, status, expires_at desc);
create index community_posts_author_id_idx on public.community_posts (author_id);
create index community_posts_search_idx on public.community_posts using gin (search);
create trigger community_posts_set_updated_at before update on public.community_posts for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  channel public.notification_channel not null default 'inapp',
  -- delivery is deferred during Shabbat / holidays and quiet hours (session 10)
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_pending_idx on public.notifications (scheduled_for) where sent_at is null;
create index notifications_school_id_idx on public.notifications (school_id);

create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  push boolean not null default true,
  email boolean not null default true,
  digest boolean not null default true,
  quiet_hours jsonb not null default '{"start": "21:00", "end": "07:00"}'::jsonb,
  shabbat_mode boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- Versioned legal texts (terms, charter, privacy policy) and timestamped acceptances.
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  kind text not null check (kind in ('terms', 'charter', 'privacy')),
  version text not null,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  body_md text not null,
  published_at timestamptz not null default now(),
  unique (school_id, kind, version, locale)
);
create index legal_documents_school_kind_idx on public.legal_documents (school_id, kind, published_at desc);

create table public.legal_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  legal_document_id uuid not null references public.legal_documents (id) on delete cascade,
  accepted_at timestamptz not null default now(),
  ip inet,
  primary key (user_id, legal_document_id)
);
create index legal_acceptances_document_idx on public.legal_acceptances (legal_document_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_log_school_created_idx on public.audit_log (school_id, created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
