-- L'assistant de Kesher : une bulle qui répond avec ce que la personne voit déjà (ADR-0088).
--
-- The assistant reads nothing of its own: every question is answered by running the
-- application's own queries with the reader's own session, under the reader's own policies.
-- What it may see is therefore exactly what the reader may see — a parent of one child gets
-- nothing about another, because the database gives the reader nothing about another.
--
-- The database keeps only a count: how many questions a person asked on a given day, so that
-- the provider's bill has a ceiling. Not a word of the questions, nor of the answers. The count
-- is written by `assistant_take_question()`, which nobody can make count for someone else.
--
-- On by default, like « S'entraîner » (choice of the porteur); a school turns it off with
-- `modules.assistant = false`.

create table public.assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  questions integer not null default 0 check (questions >= 0),
  primary key (user_id, day)
);
comment on table public.assistant_usage is
  'Questions asked to the assistant per person and per day — a count, never a content (ADR-0088).';

alter table public.assistant_usage enable row level security;

create policy assistant_usage_select on public.assistant_usage for select to authenticated
  using (user_id = (select auth.uid()));
-- No write policy: the count moves only through assistant_take_question().

/** Daily allowance per person: generous for a family, a ceiling for the bill. */
create or replace function public.assistant_take_question()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Europe/Paris')::date;
  v_count integer;
  c_limit constant integer := 60;
begin
  if v_uid is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  insert into public.assistant_usage as usage (user_id, day, questions)
  values (v_uid, v_day, 1)
  on conflict (user_id, day) do update set questions = usage.questions + 1
  returning questions into v_count;
  if v_count > c_limit then
    update public.assistant_usage set questions = c_limit where user_id = v_uid and day = v_day;
    return false;
  end if;
  return true;
end
$$;
revoke all on function public.assistant_take_question() from public, anon;
grant execute on function public.assistant_take_question() to authenticated;

-- Counts older than a month say nothing anyone needs: the nightly purge removes them.
create or replace function public.purge_assistant_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_service_role() then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  delete from public.assistant_usage where day < (now() at time zone 'Europe/Paris')::date - 31;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;
revoke all on function public.purge_assistant_usage() from public, anon, authenticated;
grant execute on function public.purge_assistant_usage() to service_role;
