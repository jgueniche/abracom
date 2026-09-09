-- Polls inside a conversation.
--
-- "Who is coming?" was only answerable through an event's RSVP, which means an
-- event has to exist first and the question has to be about attendance. A poll
-- lives in the thread where the question is actually being asked — a class
-- group deciding on a date, a trip counting accompanying adults — and, when it
-- carries an event, links back to it.
--
-- Votes are attributed, not anonymous: the point of asking a class group is to
-- know who answered what. Anyone who can read the thread sees the tally.

create table public.thread_polls (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  question text not null check (char_length(question) between 3 and 300),
  options text[] not null check (array_length(options, 1) between 2 and 10),
  multiple boolean not null default false,
  closes_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index thread_polls_thread_idx on public.thread_polls (thread_id, created_at desc);
create index thread_polls_message_idx on public.thread_polls (message_id);
create index thread_polls_event_idx on public.thread_polls (event_id);

create table public.poll_votes (
  poll_id uuid not null references public.thread_polls (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option_index smallint not null check (option_index >= 0 and option_index < 10),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id, option_index)
);
create index poll_votes_user_idx on public.poll_votes (user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.thread_polls enable row level security;
create policy thread_polls_select on public.thread_polls for select to authenticated
  using (
    public.is_thread_member(thread_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
  );
create policy thread_polls_insert on public.thread_polls for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_thread_member(thread_id, (select auth.uid()))
    and exists (
      select 1 from public.threads t
      where t.id = thread_id and not t.locked and not t.archived
        and (t.allow_replies or public.is_thread_moderator(t.id, (select auth.uid())))
    )
  );
create policy thread_polls_update on public.thread_polls for update to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_thread_moderator(thread_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
  )
  with check (
    created_by = (select auth.uid())
    or public.is_thread_moderator(thread_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
  );
create policy thread_polls_delete on public.thread_polls for delete to authenticated
  using (
    public.is_thread_moderator(thread_id, (select auth.uid()))
    or public.is_school_admin(school_id, (select auth.uid()))
  );

alter table public.poll_votes enable row level security;
create policy poll_votes_select on public.poll_votes for select to authenticated
  using (
    exists (
      select 1 from public.thread_polls p
      where p.id = poll_id
        and (public.is_thread_member(p.thread_id, (select auth.uid()))
             or public.is_school_admin(p.school_id, (select auth.uid())))
    )
  );
create policy poll_votes_insert on public.poll_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.thread_polls p
      join public.threads t on t.id = p.thread_id
      where p.id = poll_id
        and public.is_thread_member(p.thread_id, (select auth.uid()))
        and p.closed_at is null
        and (p.closes_at is null or p.closes_at > now())
        and not t.locked and not t.archived
    )
  );
create policy poll_votes_delete on public.poll_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── creating a poll ──────────────────────────────────────────────────────────
-- The poll is announced by a real message, so it appears in the timeline, it is
-- searchable, and the existing notification trigger fans it out like any other.
create or replace function public.create_thread_poll(
  thread_ uuid,
  question_ text,
  options_ text[],
  multiple_ boolean default false,
  closes_at_ timestamptz default null,
  event_ uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  school uuid;
  msg uuid;
  poll uuid;
  clean_question text := nullif(btrim(coalesce(question_, '')), '');
  clean_options text[];
begin
  if me is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;

  select t.school_id into school
  from public.threads t
  where t.id = thread_ and not t.locked and not t.archived
    and public.is_thread_member(t.id, me)
    and (t.allow_replies or public.is_thread_moderator(t.id, me));
  if school is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;

  select array_agg(o order by ord) into clean_options
  from (
    select btrim(o) as o, ord
    from unnest(coalesce(options_, '{}'::text[])) with ordinality as u(o, ord)
    where btrim(o) <> ''
  ) as kept;

  if clean_question is null or char_length(clean_question) > 300
    or coalesce(array_length(clean_options, 1), 0) < 2
    or array_length(clean_options, 1) > 10
    or exists (select 1 from unnest(clean_options) as x(o) where char_length(x.o) > 120)
  then
    raise exception 'Sondage invalide' using errcode = 'check_violation';
  end if;

  insert into public.messages (thread_id, author_id, body)
  values (thread_, me, clean_question)
  returning id into msg;

  insert into public.thread_polls
    (thread_id, school_id, message_id, event_id, question, options, multiple, closes_at, created_by)
  values
    (thread_, school, msg, event_, clean_question, clean_options, coalesce(multiple_, false),
     closes_at_, me)
  returning id into poll;

  return poll;
end
$$;
revoke all on function public.create_thread_poll(uuid, text, text[], boolean, timestamptz, uuid)
  from public, anon;
grant execute on function public.create_thread_poll(uuid, text, text[], boolean, timestamptz, uuid)
  to authenticated, service_role;

-- ── voting ───────────────────────────────────────────────────────────────────
-- One call replaces the caller's whole answer, so changing your mind is a
-- normal move rather than a delete followed by an insert that can half-fail.
create or replace function public.vote_in_poll(poll_ uuid, choices smallint[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  poll public.thread_polls;
  picks smallint[] := coalesce(choices, '{}'::smallint[]);
begin
  if me is null then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;

  select * into poll from public.thread_polls p where p.id = poll_;
  if poll.id is null or not public.is_thread_member(poll.thread_id, me) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if poll.closed_at is not null or (poll.closes_at is not null and poll.closes_at <= now()) then
    raise exception 'Sondage clos' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from unnest(picks) as x(i)
    where x.i < 0 or x.i >= array_length(poll.options, 1)
  ) then
    raise exception 'Choix invalide' using errcode = 'check_violation';
  end if;
  if not poll.multiple and array_length(picks, 1) > 1 then
    raise exception 'Un seul choix' using errcode = 'check_violation';
  end if;

  delete from public.poll_votes v where v.poll_id = poll_ and v.user_id = me;
  insert into public.poll_votes (poll_id, user_id, option_index)
  select distinct poll_, me, x.i from unnest(picks) as x(i);
end
$$;
revoke all on function public.vote_in_poll(uuid, smallint[]) from public, anon;
grant execute on function public.vote_in_poll(uuid, smallint[]) to authenticated, service_role;

-- ── closing ──────────────────────────────────────────────────────────────────
create or replace function public.close_poll(poll_ uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  poll public.thread_polls;
begin
  select * into poll from public.thread_polls p where p.id = poll_;
  if poll.id is null then
    raise exception 'Sondage introuvable' using errcode = 'no_data_found';
  end if;
  if not (poll.created_by = me or public.is_thread_moderator(poll.thread_id, me)
          or public.is_school_admin(poll.school_id, me)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  update public.thread_polls set closed_at = now() where id = poll_ and closed_at is null;
end
$$;
revoke all on function public.close_poll(uuid) from public, anon;
grant execute on function public.close_poll(uuid) to authenticated, service_role;

-- Realtime: the thread view already listens on `messages`; polls and votes ride
-- the same channel so a tally moves without a reload.
alter publication supabase_realtime add table public.thread_polls;
alter publication supabase_realtime add table public.poll_votes;
