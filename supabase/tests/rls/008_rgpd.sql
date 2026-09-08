-- pgTAP: RGPD (session 14) — export limited to the caller, self-service deletion, retention purge.
begin;
select plan(11);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end $$;

\set admin '''a0000000-0000-4000-8000-000000000001'''
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set parent3_a '''c0000000-0000-4000-8000-000000030001'''
\set talia '''d0000000-0000-4000-8000-000000030001'''
\set group_ps '''00000000-0000-4000-8000-000000003090'''

-- export ---------------------------------------------------------------------------------
select pg_temp.login(:parent1);
select is(jsonb_array_length(public.export_my_data() -> 'children'), 2, 'the export lists the caller''s children');
select ok(jsonb_array_length(public.export_my_data() -> 'messages') >= 0 and (public.export_my_data() ->> 'user_id')::uuid = :parent1, 'the export is scoped to the caller');
select ok((public.export_my_data() -> 'profile' ->> 'first_name') is not null, 'the export includes the profile');

-- deletion --------------------------------------------------------------------------------
select pg_temp.login(:admin);
select throws_ok('select public.delete_my_account()', '23514', null, 'the last administrator cannot delete their account');

select pg_temp.login(:parent3_a);
select lives_ok('select public.delete_my_account()', 'a parent deletes their account');
select is((select first_name from public.profiles where id = :parent3_a), 'Compte', 'the profile is anonymised');
select is((select count(*) from public.student_guardians where user_id = :parent3_a), 0::bigint, 'the guardian links are removed');
select is((select status from public.memberships where user_id = :parent3_a limit 1), 'suspended'::public.membership_status, 'memberships are suspended');

-- retention purge -------------------------------------------------------------------------
select pg_temp.service();
insert into public.messages (thread_id, author_id, body, created_at)
values (:group_ps, :parent1, 'Vieux message', now() - interval '3 years');
update public.enrollments set joined_on = '2022-09-01', left_on = '2023-06-30' where student_id = :talia;
update public.students set status = 'left' where id = :talia;
select ok((public.purge_expired_data() ->> 'messages')::int >= 1, 'messages older than two years are purged');
select is((select first_name from public.students where id = :talia), 'Élève', 'students who left long ago are anonymised');
select pg_temp.login(:parent1);
select throws_ok('select public.purge_expired_data()', '42501', null, 'the purge is reserved to the service role');

select * from finish();
rollback;
