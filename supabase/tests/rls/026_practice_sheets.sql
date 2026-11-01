-- pgTAP : S'entraîner (ADR-0087). Une feuille d'exercices préparée par l'IA se lit par
-- qui lit son devoir, et par personne d'autre ; seul le serveur l'écrit, si bien qu'aucune
-- famille ne peut placer ses propres mots sous l'étiquette « proposé par l'IA » ; l'équipe
-- de la classe retire, jette ou ferme, et chacun de ces gestes est journalisé.
begin;
select plan(33);

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

\set school '''00000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set class_cp '''00000000-0000-4000-8000-000000000517'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
\set staff '''a0000000-0000-4000-8000-000000000002'''
-- parent of Maya (PS Tournesols) and Noam (CP Oliviers)
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
-- a parent of CE1 Cèdres only
\set other_parent '''c0000000-0000-4000-8000-000000100001'''
\set post '''e0000000-0000-4000-8000-000000000087'''
\set staff_post '''e0000000-0000-4000-8000-000000000088'''
\set journal '''e0000000-0000-4000-8000-000000000089'''
\set sheet_same '''e0000000-0000-4000-8000-0000000008a1'''
\set sheet_easy '''e0000000-0000-4000-8000-0000000008a2'''
\set sheet_staff '''e0000000-0000-4000-8000-0000000008a3'''

-- ══ 1. Le schéma ═════════════════════════════════════════════════════════
select ok((select relrowsecurity from pg_class where oid = 'public.practice_sheets'::regclass),
  'practice sheets are under row level security');
select col_default_is('public', 'classes', 'practice_enabled', 'true',
  'a class offers practice sheets unless its team says otherwise');

-- A homework of PS Tournesols, one for the team only, and a journal entry.
insert into public.class_posts (id, school_id, class_id, author_id, type, title, subject, due_on, published_at)
values (:post, :school, :class_ps, :teacher_ps, 'homework', 'Compter jusqu''à 5', 'Mathématiques', current_date + 2, now()),
       (:journal, :school, :class_ps, :teacher_ps, 'journal', 'La sortie au parc', null, null, now());
insert into public.class_posts (id, school_id, class_id, author_id, type, title, subject, due_on, published_at, visibility)
values (:staff_post, :school, :class_ps, :teacher_ps, 'homework', 'Préparer la fiche', 'Français', current_date + 3, now(), 'staff');

-- ══ 2. Seul le serveur écrit ═════════════════════════════════════════════
select pg_temp.service();
select lives_ok(
  format($$insert into public.practice_sheets (id, school_id, class_id, post_id, level, status, content, model)
           values (%L, %L, %L, %L, 'same', 'ready', '{"title": "Les pommes"}', 'gemini-3.8-flash')$$,
         :sheet_same, :school, :class_cp, :post),
  'the server writes a ready sheet');
select is((select class_id from public.practice_sheets where id = :sheet_same), :class_ps::uuid,
  'whose class comes from its homework, whatever the writer passed');
select lives_ok(
  format($$insert into public.practice_sheets (id, post_id, level, school_id, class_id) values (%L, %L, 'easier', %L, %L)$$,
         :sheet_easy, :post, :school, :class_ps),
  'and a sheet still being prepared');
select lives_ok(
  format($$insert into public.practice_sheets (id, post_id, level, school_id, class_id, status, content) values (%L, %L, 'same', %L, %L, 'ready', '{}')$$,
         :sheet_staff, :staff_post, :school, :class_ps),
  'and a sheet of a homework kept for the team');
select throws_ok(
  format($$insert into public.practice_sheets (post_id, level, school_id, class_id) values (%L, 'same', %L, %L)$$,
         :post, :school, :class_ps),
  '23505', null, 'one sheet per homework and per level: the class shares it');
select throws_ok(
  format($$insert into public.practice_sheets (post_id, level, school_id, class_id) values (%L, 'harder', %L, %L)$$,
         :journal, :school, :class_ps),
  '23514', null, 'a sheet is prepared from a homework, not from a journal entry');
select throws_ok(
  format($$insert into public.practice_sheets (post_id, level, school_id, class_id, status) values (%L, 'harder', %L, %L, 'ready')$$,
         :post, :school, :class_ps),
  '23514', null, 'a sheet is not ready without its exercises');
select throws_ok(
  format($$update public.practice_sheets set illustration_path = 'ailleurs/x.webp' where id = %L$$, :sheet_same),
  '23514', null, 'an illustration lives in the folder of its sheet — the storage policy covers it');
select pg_temp.owner();

-- ══ 3. Qui lit le devoir lit la feuille ══════════════════════════════════
select pg_temp.login(:parent1);
select is((select count(*) from public.practice_sheets where post_id = :post), 2::bigint,
  'a parent of the class sees both sheets of the homework');
select is((select count(*) from public.practice_sheets where id = :sheet_staff), 0::bigint,
  'but not the sheet of a homework kept for the team');
select throws_ok(
  format($$insert into public.practice_sheets (post_id, level, school_id, class_id, status, content) values (%L, 'harder', %L, %L, 'ready', '{"title": "Mes mots"}')$$,
         :post, :school, :class_ps),
  '42501', null, 'a parent cannot put a sheet of their own in front of the class');
update public.practice_sheets set content = '{"title": "Réécrit"}' where id = :sheet_same;
delete from public.practice_sheets where id = :sheet_easy;
select throws_ok(
  format($$select public.set_practice_sheet_hidden(%L, true)$$, :sheet_same),
  '42501', null, 'nor withdraw one');
select throws_ok(
  format($$select public.discard_practice_sheet(%L)$$, :sheet_same),
  '42501', null, 'nor throw one away');
select throws_ok(
  format($$select public.set_class_practice(%L, false)$$, :class_ps),
  '42501', null, 'nor close the feature for the class');
select pg_temp.owner();
select is((select content ->> 'title' from public.practice_sheets where id = :sheet_same), 'Les pommes',
  'what a parent''s update tried to write was not written');
select is((select count(*) from public.practice_sheets where id = :sheet_easy), 1::bigint,
  'and what their delete tried to remove is still there');

select pg_temp.login(:other_parent);
select is((select count(*) from public.practice_sheets where post_id = :post), 0::bigint,
  'a parent of another class sees no sheet');

select pg_temp.login(:teacher_ps);
select is((select count(*) from public.practice_sheets where post_id in (:post, :staff_post)), 3::bigint,
  'the teacher of the class sees all three');

-- ══ 4. L'équipe retire, remet, jette, ferme ══════════════════════════════
select lives_ok(format($$select public.set_practice_sheet_hidden(%L, true)$$, :sheet_same),
  'the teacher withdraws a sheet');
select pg_temp.login(:parent1);
select is((select count(*) from public.practice_sheets where post_id = :post), 1::bigint,
  'the families no longer see it');
select pg_temp.login(:teacher_ps);
select is((select count(*) from public.practice_sheets where id = :sheet_same), 1::bigint,
  'the team still does, to put it back');
select lives_ok(format($$select public.set_practice_sheet_hidden(%L, false)$$, :sheet_same),
  'and puts it back');
select pg_temp.login(:parent1);
select is((select count(*) from public.practice_sheets where post_id = :post), 2::bigint,
  'the families see it again');

select pg_temp.login(:teacher_ps);
select lives_ok(format($$select public.discard_practice_sheet(%L)$$, :sheet_easy),
  'the teacher throws a sheet away to have it prepared again');
select lives_ok(format($$select public.set_class_practice(%L, false)$$, :class_ps),
  'and closes the feature for the class');
select pg_temp.owner();
select is((select practice_enabled from public.classes where id = :class_ps), false,
  'the class is closed');
select is((select count(*) from public.audit_log
            where action in ('practice_sheet.hide', 'practice_sheet.show', 'practice_sheet.discard', 'practice.disable')
              and actor_id = :teacher_ps), 4::bigint,
  'each of the four gestures is in the audit log');

select pg_temp.login(:staff);
select lives_ok(format($$select public.set_class_practice(%L, true)$$, :class_ps),
  'the office opens it again');

-- ══ 5. Les fichiers suivent la feuille ═══════════════════════════════════
select pg_temp.owner();
insert into storage.objects (bucket_id, name)
values ('practice', :school || '/' || :class_ps || '/' || :sheet_same || '/illustration.webp');

select pg_temp.login(:parent1);
select is((select count(*) from storage.objects where bucket_id = 'practice'
            and name like :school || '/' || :class_ps || '/' || :sheet_same || '/%'), 1::bigint,
  'a parent of the class reads the illustration of the sheet');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('practice', %L)$$,
         :school || '/' || :class_ps || '/' || :sheet_same || '/autre.webp'),
  '42501', null, 'but writes nothing beside it');

select pg_temp.login(:other_parent);
select is((select count(*) from storage.objects where bucket_id = 'practice'
            and name like :school || '/' || :class_ps || '/' || :sheet_same || '/%'), 0::bigint,
  'a parent of another class reads nothing');

select * from finish();
rollback;
