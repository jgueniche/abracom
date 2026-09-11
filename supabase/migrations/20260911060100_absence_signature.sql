-- Session 20, écart n° 2 — le mot d'excuse signé depuis le téléphone.
--
-- `absences` already carried a declaration and an optional scanned justification;
-- `document_signatures` already carried a timestamped electronic signature. The
-- gap was only that the two had never been introduced. A family should be able
-- to write the excuse and sign it on the phone, at 7 a.m., without a printer.
--
-- Boundary, deliberately: **a signature is a justification submitted, not a
-- justification granted**. The school still decides; `absences.status` stays out
-- of the family's reach, as the hardening of session 15 established.

create table if not exists public.absence_justifications (
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references public.absences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- What the family wrote, in their own words. Never composed for them.
  statement text not null check (char_length(statement) between 1 and 1000),
  -- The name typed at the moment of signing, as on a paper note.
  signed_name text not null check (char_length(signed_name) between 2 and 120),
  signed_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (absence_id, user_id)
);
create index if not exists absence_justifications_absence_idx
  on public.absence_justifications (absence_id);
create index if not exists absence_justifications_user_idx
  on public.absence_justifications (user_id);
alter table public.absence_justifications drop constraint if exists absence_justifications_user_profile_fkey;
alter table public.absence_justifications add constraint absence_justifications_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- The signer and the hour are stamped by the database, never by the caller:
-- `document_signatures` trusts its Server Action for both, which leaves a direct
-- PostgREST write free to backdate a note. This one cannot be lied to.
create or replace function public.stamp_absence_justification()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.signed_at := now();
  return new;
end
$$;
drop trigger if exists absence_justifications_stamp on public.absence_justifications;
create trigger absence_justifications_stamp before insert on public.absence_justifications
  for each row execute function public.stamp_absence_justification();

-- A signature is a fact: it is written once and never rewritten.
drop trigger if exists absence_justifications_freeze on public.absence_justifications;
create trigger absence_justifications_freeze before update on public.absence_justifications
  for each row execute function public.freeze_columns('absence_id', 'user_id', 'signed_at', 'statement', 'signed_name');

alter table public.absence_justifications enable row level security;
drop policy if exists absence_justifications_select on public.absence_justifications;
create policy absence_justifications_select on public.absence_justifications for select to authenticated
  using (exists (
    select 1 from public.absences a
    where a.id = absence_id and public.can_access_student(a.student_id, (select auth.uid()))
  ));
-- Only a guardian who may write for this child, and only on their own absence.
drop policy if exists absence_justifications_insert on public.absence_justifications;
create policy absence_justifications_insert on public.absence_justifications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.absences a
      where a.id = absence_id
        and public.can_access_student(a.student_id, (select auth.uid()))
        and public.can_write_in_school(a.school_id, (select auth.uid()))
    )
  );
-- Nobody edits a signature; the direction alone may remove one (a mistaken note).
drop policy if exists absence_justifications_delete on public.absence_justifications;
create policy absence_justifications_delete on public.absence_justifications for delete to authenticated
  using (exists (
    select 1 from public.absences a
    where a.id = absence_id and public.is_school_admin(a.school_id, (select auth.uid()))
  ));

/**
 * Declares an absence and signs its excuse in one gesture — the point of the
 * feature is that a parent does it once, from a phone, before the school day.
 * Returns the absence id.
 */
create or replace function public.declare_and_sign_absence(
  student_ uuid,
  kind_ public.absence_kind,
  starts_on_ date,
  ends_on_ date,
  statement_ text,
  signed_name_ text,
  ip_ inet default null,
  user_agent_ text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  school uuid;
  created uuid;
begin
  if auth.uid() is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  select s.school_id into school from public.students s where s.id = student_;
  if school is null then
    raise exception 'Élève introuvable' using errcode = 'no_data_found';
  end if;
  -- A guardian of this child, allowed to write in this school (never a read-only
  -- guardian, never a blocked one — `can_access_student` already says so).
  if not (public.can_access_student(student_) and public.can_write_in_school(school)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if ends_on_ < starts_on_ then
    raise exception 'Dates invalides' using errcode = 'check_violation';
  end if;

  insert into public.absences (school_id, student_id, declared_by, kind, status, starts_on, ends_on, reason)
  values (school, student_, auth.uid(), kind_, 'declared', starts_on_, ends_on_,
          left(btrim(statement_), 500))
  returning id into created;

  insert into public.absence_justifications (absence_id, user_id, statement, signed_name, ip, user_agent)
  values (created, auth.uid(), btrim(statement_), btrim(signed_name_), ip_, left(user_agent_, 300));

  return created;
end
$$;
revoke all on function public.declare_and_sign_absence(uuid, public.absence_kind, date, date, text, text, inet, text) from public, anon;
grant execute on function public.declare_and_sign_absence(uuid, public.absence_kind, date, date, text, text, inet, text) to authenticated, service_role;
