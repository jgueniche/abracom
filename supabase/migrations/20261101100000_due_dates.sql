-- Une échéance pour ce que l'école attend des familles (ADR-0082).
--
-- The parent's home now opens on « À faire »: a circular to read and acknowledge, a
-- document to sign. Neither had a date by which it was wanted, so the home could only
-- say *what* was owed, never *by when* — « avant mercredi » is what makes a line urgent
-- rather than merely present. The school gives the date when it publishes; nothing is
-- inferred, and a line without one simply has none.
--
--   announcements.due_on   the day an acknowledgement is wanted by (requires_ack)
--   documents.due_on       the day a signature is wanted by (requires_signature)
--
-- Plain nullable columns: the existing policies already decide who may write a row,
-- so who may set its date follows without a policy of its own.
--
-- The test school gets dates that move with the calendar, as its content does since
-- ADR-0077: `refresh_test_school_due_dates()` gives every pending acknowledgement and
-- signature of a `modules.test` school a school day in the coming week or two, and is
-- run once here and each night where pg_cron exists.

alter table public.announcements add column if not exists due_on date;
alter table public.documents add column if not exists due_on date;

comment on column public.announcements.due_on is
  'The day the acknowledgement is wanted by (ADR-0082). Shown to the families; enforces nothing.';
comment on column public.documents.due_on is
  'The day the signature is wanted by (ADR-0082). Shown to the families; enforces nothing.';

create or replace function public.refresh_test_school_due_dates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_documents integer;
  v_announcements integer;
begin
  -- Two days apart from the day after tomorrow, moved off the weekend: a spread of dates the
  -- home can sort, and none of them in the past.
  with pending as (
    select doc.id, row_number() over (order by doc.published_at desc, doc.id) as rank
      from public.documents doc
      join public.schools school on school.id = doc.school_id
     where school.modules @> '{"test": true}'::jsonb
       and doc.requires_signature
       and doc.deleted_at is null
       and (doc.due_on is null or doc.due_on < v_today)
  ), dated as (
    select id, v_today + (2 * rank)::integer as day from pending
  )
  update public.documents doc
     set due_on = dated.day + case extract(isodow from dated.day)::integer
                                when 6 then 2 when 7 then 1 else 0 end
    from dated
   where dated.id = doc.id;
  get diagnostics v_documents = row_count;

  with pending as (
    select announcement.id,
           row_number() over (order by announcement.published_at desc, announcement.id) as rank
      from public.announcements announcement
      join public.schools school on school.id = announcement.school_id
     where school.modules @> '{"test": true}'::jsonb
       and announcement.requires_ack
       and announcement.deleted_at is null
       and (announcement.due_on is null or announcement.due_on < v_today)
  ), dated as (
    select id, v_today + (1 + 2 * rank)::integer as day from pending
  )
  update public.announcements announcement
     set due_on = dated.day + case extract(isodow from dated.day)::integer
                                when 6 then 2 when 7 then 1 else 0 end
    from dated
   where dated.id = announcement.id;
  get diagnostics v_announcements = row_count;

  return v_documents + v_announcements;
end;
$$;
revoke all on function public.refresh_test_school_due_dates() from public, anon, authenticated;
grant execute on function public.refresh_test_school_due_dates() to service_role;

select public.refresh_test_school_due_dates();

-- Each night, after the content refresh (4:15 UTC, 20261018090200), where pg_cron exists.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'kesher-test-school-due-dates',
      '25 4 * * *',
      'select public.refresh_test_school_due_dates();'
    );
  end if;
end
$$;
