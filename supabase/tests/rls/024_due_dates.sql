-- pgTAP : l'échéance des accusés de lecture et des signatures (ADR-0082).
-- Deux colonnes facultatives, écrites par l'école sous les politiques existantes ; l'école
-- test reçoit des dates qui avancent avec le calendrier, et aucune vraie école n'est touchée.
begin;
select plan(9);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

create or replace function pg_temp.owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;

create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end $$;

\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set real_school '''f0000000-0000-4000-8000-000000000001'''
\set real_document '''f0000000-0000-4000-8000-0000000000d1'''

select col_is_null('public', 'announcements', 'due_on', 'an announcement may have no due date');
select col_is_null('public', 'documents', 'due_on', 'a document may have no due date');

-- A real school, with a document to sign and no date.
insert into public.schools (id, slug, name, city) values (:real_school, 'ecole-reelle', 'École réelle', 'Neuilly-sur-Seine');
insert into public.documents (id, school_id, title, storage_path, mime, size_bytes, audience, requires_signature, published_at)
values (:real_document, :real_school, 'Autorisation (réelle)', 'x/y.pdf', 'application/pdf', 1, 'school', true, now());

select pg_temp.login(:parent1);
select throws_ok($$select public.refresh_test_school_due_dates()$$, '42501', null,
  'a family may not move the test school''s dates');

select pg_temp.service();
update public.documents set due_on = null
 where school_id = (select id from public.schools where modules @> '{"test": true}'::jsonb limit 1);
select cmp_ok(public.refresh_test_school_due_dates(), '>', 0,
  'the service key gives the test school''s pending items a date');
select pg_temp.owner();

select is((select count(*) from public.documents d join public.schools s on s.id = d.school_id
           where s.modules @> '{"test": true}'::jsonb and d.requires_signature and d.deleted_at is null
             and d.due_on is null), 0::bigint,
  'every document of the test school awaiting a signature now has one');
select is((select count(*) from public.documents d join public.schools s on s.id = d.school_id
           where s.modules @> '{"test": true}'::jsonb and d.due_on < (now() at time zone 'Europe/Paris')::date),
  0::bigint, 'none of them in the past');
select is((select count(*) from public.documents where due_on is not null
           and extract(isodow from due_on) in (6, 7))
        + (select count(*) from public.announcements where due_on is not null
           and extract(isodow from due_on) in (6, 7)), 0::bigint,
  'and none on a weekend');
select is((select due_on from public.documents where id = :real_document), null,
  'a real school''s document keeps the date its school gave it: none');

-- Under the policies a family cannot set a date on a document.
select pg_temp.login(:parent1);
update public.documents set due_on = '2030-01-01'
 where school_id = (select id from public.schools where modules @> '{"test": true}'::jsonb limit 1);
select pg_temp.owner();
select is((select count(*) from public.documents where due_on = '2030-01-01'), 0::bigint,
  'a family cannot write a due date');

select * from finish();
rollback;
