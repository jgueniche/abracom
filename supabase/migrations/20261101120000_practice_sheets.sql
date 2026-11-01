-- S'entraîner : une feuille d'exercices préparée par l'IA à partir d'un devoir (ADR-0087).
--
-- A parent opens a homework and asks for a sheet « plus facile », « pareil » or « pour aller
-- plus loin ». The server reads the homework the way the parent reads it (RLS), asks the model
-- for exercises, lays them out, draws one illustration and records the voice of what is to be
-- listened to. One sheet per homework and per level, shared by the whole class: the second
-- family to ask reads the sheet the first one asked for, and pays nothing.
--
-- Who reads a sheet is exactly who reads its homework — the policy asks `class_posts`, under
-- the reader's own policies, whether the homework is there. Nobody but the server writes one:
-- there is no insert, update or delete policy, so a family cannot put words of its own in front
-- of the class under the label « proposé par l'IA ». The team of the class can withdraw a sheet
-- (`set_practice_sheet_hidden`), throw it away to have it prepared again
-- (`discard_practice_sheet`), or close the feature for the class (`set_class_practice`); each
-- is written to the audit log, as moderation is.
--
-- On by default, as the porteur asked: `classes.practice_enabled` defaults to true and a school
-- turns it off with `modules.practice = false`.

create type public.practice_level as enum ('easier', 'same', 'harder');
create type public.practice_status as enum ('pending', 'ready', 'failed');

alter table public.classes add column if not exists practice_enabled boolean not null default true;
comment on column public.classes.practice_enabled is
  'Whether the families of the class may ask for AI practice sheets (ADR-0087). Set by its team.';

create table public.practice_sheets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  post_id uuid not null references public.class_posts (id) on delete cascade,
  level public.practice_level not null,
  status public.practice_status not null default 'pending',
  -- What the server is doing while the family waits — shown as it is, not as an animation.
  stage text check (stage in ('reading', 'writing', 'drawing', 'voicing')),
  content jsonb,
  -- Hebrew or Jewish studies: shown with a « bêta » warning (decided by the porteur).
  beta boolean not null default false,
  illustration_path text,
  model text check (char_length(model) <= 120),
  -- A short internal code (`invalid_output`, `provider_error`…), never shown to a family.
  error text check (char_length(error) <= 200),
  requested_by uuid references auth.users (id) on delete set null,
  hidden_at timestamptz,
  hidden_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, level),
  check ((status = 'ready') = (content is not null)),
  check (illustration_path is null
         or illustration_path like school_id::text || '/' || class_id::text || '/' || id::text || '/%')
);
comment on table public.practice_sheets is
  'AI practice sheets prepared from a homework, one per level, shared by the class (ADR-0087).';

create index practice_sheets_class_id_idx on public.practice_sheets (class_id);
create index practice_sheets_school_id_idx on public.practice_sheets (school_id);
create index practice_sheets_requested_idx on public.practice_sheets (requested_by, created_at);
create index practice_sheets_hidden_by_idx on public.practice_sheets (hidden_by);

create trigger practice_sheets_set_updated_at before update on public.practice_sheets
  for each row execute function public.set_updated_at();
create trigger practice_sheets_freeze before update on public.practice_sheets
  for each row execute function public.freeze_columns('school_id', 'class_id', 'post_id', 'level');

-- The class and the school always come from the homework, whatever the writer passed.
create or replace function public.practice_sheet_fill_from_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
begin
  select p.school_id, p.class_id, p.type into v_post from public.class_posts p where p.id = new.post_id;
  if not found or v_post.type <> 'homework' then
    raise exception 'Une feuille d''entraînement se prépare à partir d''un devoir'
      using errcode = 'check_violation';
  end if;
  new.school_id := v_post.school_id;
  new.class_id := v_post.class_id;
  return new;
end
$$;
revoke all on function public.practice_sheet_fill_from_post() from public, anon, authenticated;

create trigger practice_sheets_fill_from_post before insert on public.practice_sheets
  for each row execute function public.practice_sheet_fill_from_post();

alter table public.practice_sheets enable row level security;

-- Read: whoever reads the homework. A withdrawn sheet stays visible to the team who withdrew it.
create policy practice_sheets_select on public.practice_sheets for select to authenticated
  using (
    exists (select 1 from public.class_posts p where p.id = post_id)
    and (
      hidden_at is null
      or public.is_class_teacher(class_id, (select auth.uid()))
      or public.is_school_staff(school_id, (select auth.uid()))
    )
  );
-- No write policy: the server writes with the service key, after checking the reader.

-- ── The team's three gestures ───────────────────────────────────────────────

create or replace function public.set_practice_sheet_hidden(p_sheet uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sheet record;
  v_uid uuid := auth.uid();
begin
  select id, school_id, class_id into v_sheet from public.practice_sheets where id = p_sheet;
  if not found
     or v_uid is null
     or not (public.is_class_teacher(v_sheet.class_id, v_uid) or public.is_school_staff(v_sheet.school_id, v_uid)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  update public.practice_sheets
     set hidden_at = case when p_hidden then now() end,
         hidden_by = case when p_hidden then v_uid end
   where id = p_sheet;
  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  values (v_sheet.school_id, v_uid, case when p_hidden then 'practice_sheet.hide' else 'practice_sheet.show' end,
          'practice_sheets', p_sheet, jsonb_build_object('class_id', v_sheet.class_id));
end
$$;
revoke all on function public.set_practice_sheet_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_practice_sheet_hidden(uuid, boolean) to authenticated;

-- Throw a sheet away so that the next reader has it prepared again. Its files are removed by
-- the server action that calls this (it holds the service key), or later by the storage sweep.
create or replace function public.discard_practice_sheet(p_sheet uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sheet record;
  v_uid uuid := auth.uid();
begin
  select id, school_id, class_id, post_id, level into v_sheet from public.practice_sheets where id = p_sheet;
  if not found
     or v_uid is null
     or not (public.is_class_teacher(v_sheet.class_id, v_uid) or public.is_school_staff(v_sheet.school_id, v_uid)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  delete from public.practice_sheets where id = p_sheet;
  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  values (v_sheet.school_id, v_uid, 'practice_sheet.discard', 'practice_sheets', p_sheet,
          jsonb_build_object('class_id', v_sheet.class_id, 'post_id', v_sheet.post_id, 'level', v_sheet.level));
end
$$;
revoke all on function public.discard_practice_sheet(uuid) from public, anon;
grant execute on function public.discard_practice_sheet(uuid) to authenticated;

create or replace function public.set_class_practice(p_class uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid := public.class_school_id(p_class);
  v_uid uuid := auth.uid();
begin
  if v_school is null
     or v_uid is null
     or not (public.is_class_teacher(p_class, v_uid) or public.is_school_staff(v_school, v_uid)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  update public.classes set practice_enabled = p_enabled where id = p_class;
  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
  values (v_school, v_uid, case when p_enabled then 'practice.enable' else 'practice.disable' end,
          'classes', p_class, '{}'::jsonb);
end
$$;
revoke all on function public.set_class_practice(uuid, boolean) from public, anon;
grant execute on function public.set_class_practice(uuid, boolean) to authenticated;

-- ── Storage: {school_id}/{class_id}/{sheet_id}/{file} ───────────────────────
-- Illustrations (WebP) and recorded voices (WAV). Read by whoever reads the sheet; written by
-- the server only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('practice', 'practice', false, 10 * 1024 * 1024, array['image/webp', 'image/png', 'audio/wav'])
on conflict (id) do nothing;

create policy storage_practice_select on storage.objects for select to authenticated
  using (
    bucket_id = 'practice'
    and exists (
      select 1 from public.practice_sheets s
       where s.id = public.try_uuid((storage.foldername(name))[3])
         and s.class_id = public.try_uuid((storage.foldername(name))[2])
    )
  );
