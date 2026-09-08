-- pgTAP: global search (session 13) follows the caller's visibility.
begin;
select plan(5);

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end $$;

\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
\set ann_class_ce1 '''00000000-0000-4000-8000-000000001285'''

select pg_temp.login(:parent1);
select ok((select count(*) from public.global_search('Roch Hachana')) > 0, 'a parent finds announcements and events about Rosh Hashana');
select is((select count(*) from public.global_search('musée') s where s.kind = 'announcement' and s.id = :ann_class_ce1), 0::bigint, 'search never returns content of another class');
select is((select count(*) from public.global_search(' ')), 0::bigint, 'blank queries return nothing');
select pg_temp.login(:staff);
select ok((select count(*) from public.global_search('musée') s where s.id = :ann_class_ce1) > 0, 'staff finds every announcement of the school');
select pg_temp.logout();
select throws_ok('select * from public.global_search(''Roch'')', '42501', null, 'anonymous users cannot search');

select * from finish();
rollback;
