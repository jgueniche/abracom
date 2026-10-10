-- pgTAP : l'espace devoirs (session 33). Une page jointe à un devoir est lue par
-- les familles de la classe et par personne d'autre ; seule l'équipe de la
-- classe en dépose ; « Fait » se coche par les parents, pas par un responsable
-- en lecture seule ; et un fichier de messagerie ne se dépose que là où
-- l'on a le droit d'écrire — maintenant que le navigateur l'écrit lui-même.
begin;
select plan(30);

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

\set school '''00000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set class_ps '''00000000-0000-4000-8000-000000000514'''
\set teacher_ps '''b0000000-0000-4000-8000-000000000002'''
-- parent of Maya (PS Tournesols) and Noam (CP Oliviers)
\set parent1 '''c0000000-0000-4000-8000-000000010001'''
\set maya '''d0000000-0000-4000-8000-000000010001'''
-- Maya's father
\set parent1_spouse '''c0000000-0000-4000-8000-000000010002'''
-- a parent of CE1 Cèdres only
\set other_parent '''c0000000-0000-4000-8000-000000100001'''
-- read-only guardian of Léa (CE1 Cèdres)
\set readonly '''c0000000-0000-4000-8000-000000050003'''
\set lea '''d0000000-0000-4000-8000-000000050001'''
\set group_ps '''00000000-0000-4000-8000-000000003090'''
\set official_ps '''00000000-0000-4000-8000-000000003074'''
\set group_ce1 '''00000000-0000-4000-8000-000000003094'''
\set post '''e0000000-0000-4000-8000-000000000033'''

-- ══ 1. Le schéma ═════════════════════════════════════════════════════════
select has_column('public', 'class_post_media', 'filename', 'a page keeps the name it had');
select has_column('public', 'class_post_media', 'size_bytes', 'and its size, printed beside a PDF');
select has_column('public', 'class_post_media', 'thumb_path', 'and a light rendition for the lists');

-- ══ 2. L'équipe de la classe dépose ══════════════════════════════════════
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into public.class_posts (id, school_id, class_id, author_id, type, title, subject, due_on, published_at)
           values (%L, %L, %L, %L, 'homework', 'Réviser la fiche des sons', 'Français', current_date + 2, now())$$,
         :post, :school, :class_ps, :teacher_ps),
  'the teacher of the class sets a homework');
select lives_ok(
  format($$insert into public.class_post_media (post_id, storage_path, kind, filename, size_bytes, width, height, thumb_path, sort_order)
           values (%L, %L, 'image', 'page-12.jpg', 412000, 1800, 2400, %L, 0),
                  (%L, %L, 'pdf', 'fiche-sons.pdf', 245760, null, null, null, 1)$$,
         :post, :school || '/' || :class_ps || '/' || :post || '/page-12.webp',
         :school || '/' || :class_ps || '/' || :post || '/page-12.thumb.webp',
         :post, :school || '/' || :class_ps || '/' || :post || '/fiche-sons.pdf'),
  'and joins a photographed page and a worksheet');

select throws_ok(
  format($$insert into public.class_post_media (post_id, storage_path, kind, filename) values (%L, %L, 'pdf', %L)$$,
         :post, :school || '/' || :class_ps || '/' || :post || '/long.pdf', repeat('x', 201)),
  '23514', null, 'a file name stays under 200 characters');
select throws_ok(
  format($$insert into public.class_post_media (post_id, storage_path, kind, size_bytes) values (%L, %L, 'pdf', -1)$$,
         :post, :school || '/' || :class_ps || '/' || :post || '/neg.pdf'),
  '23514', null, 'a size is never negative');
select throws_ok(
  format($$insert into public.class_post_media (post_id, storage_path, kind, thumb_path) values (%L, %L, 'image', %L)$$,
         :post, :school || '/' || :class_ps || '/' || :post || '/p.webp',
         :school || '/' || :class_ps || '/autre/p.thumb.webp'),
  '23514', null, 'a rendition lives in the folder of its original — the storage policies cover both');

-- ══ 3. Les familles de la classe lisent, les autres non ══════════════════
select pg_temp.login(:parent1);
select is((select count(*) from public.class_post_media where post_id = :post), 2::bigint,
  'a parent of the class sees both attachments');
select is((select filename from public.class_post_media where post_id = :post and kind = 'pdf'),
  'fiche-sons.pdf', 'with the name of the worksheet');
select throws_ok(
  format($$insert into public.class_post_media (post_id, storage_path, kind) values (%L, %L, 'image')$$,
         :post, :school || '/' || :class_ps || '/' || :post || '/parent.webp'),
  '42501', null, 'a parent attaches nothing to a homework');

select pg_temp.login(:other_parent);
select is((select count(*) from public.class_post_media where post_id = :post), 0::bigint,
  'a parent of another class sees no attachment');

-- ══ 4. « Fait » : les parents cochent, le responsable en lecture seule lit ══
select pg_temp.login(:parent1);
select lives_ok(
  format($$insert into public.homework_completions (post_id, student_id, marked_by_user_id) values (%L, %L, %L)$$,
         :post, :maya, :parent1),
  'a parent ticks « Fait » for their child');
select is((select count(*) from public.homework_completions where post_id = :post), 1::bigint,
  'and reads it back');

select pg_temp.login(:teacher_ps);
select is((select count(*) from public.homework_completions where post_id = :post), 1::bigint,
  'the teacher counts it');

select pg_temp.login(:readonly);
select throws_ok(
  format($$insert into public.homework_completions (post_id, student_id, marked_by_user_id) values (%L, %L, %L)$$,
         :post, :lea, :readonly),
  '42501', null, 'a read-only guardian does not tick, even for the child they follow');

-- « Fait » is the child's state: the other parent may take it back
select pg_temp.login(:other_parent);
select lives_ok(
  format($$delete from public.homework_completions where post_id = %L and student_id = %L$$, :post, :maya),
  'a stranger''s delete runs…');
select pg_temp.login(:parent1_spouse);
select is((select count(*) from public.homework_completions where post_id = :post and student_id = :maya), 1::bigint,
  '…and removes nothing: the tick is still there for Maya''s father to see');
select lives_ok(
  format($$delete from public.homework_completions where post_id = %L and student_id = %L$$, :post, :maya),
  'Maya''s father unticks what her mother ticked');
select is((select count(*) from public.homework_completions where post_id = :post and student_id = :maya), 0::bigint,
  'and the homework is « à faire » again for both of them');

-- ══ 5. Le stockage des pages ═════════════════════════════════════════════
select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('class-media', %L)$$,
         :school || '/' || :class_ps || '/' || :post || '/page-12.webp'),
  'the teacher writes the page into the folder of her class');

select pg_temp.login(:parent1);
select is((select count(*) from storage.objects where bucket_id = 'class-media'
            and name = :school || '/' || :class_ps || '/' || :post || '/page-12.webp'), 1::bigint,
  'a parent of the class may read it');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('class-media', %L)$$,
         :school || '/' || :class_ps || '/' || :post || '/parent.webp'),
  '42501', null, 'a parent writes nothing into a class folder');

select pg_temp.login(:other_parent);
select is((select count(*) from storage.objects where bucket_id = 'class-media'
            and name = :school || '/' || :class_ps || '/' || :post || '/page-12.webp'), 0::bigint,
  'a parent of another class cannot read it');

-- ══ 6. Messagerie : déposer un fichier, c'est déjà écrire ═════════════════
select pg_temp.login(:parent1);
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('messages', %L)$$,
         :school || '/' || :group_ps || '/devoir.jpg'),
  'a parent drops a photo into the parents'' group of their class');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('messages', %L)$$,
         :school || '/' || :official_ps || '/devoir.jpg'),
  '42501', null, 'but not into the read-only channel of the class, where they cannot write');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('messages', %L)$$,
         :school || '/' || :group_ce1 || '/devoir.jpg'),
  '42501', null, 'nor into the group of a class they do not belong to');

select pg_temp.login(:teacher_ps);
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('messages', %L)$$,
         :school || '/' || :official_ps || '/consignes.pdf'),
  'the teacher writes into the read-only channel she moderates');

-- the direction closes the families' channel (session 19): the class threads
-- are governed by it, so the upload stops where the message stops
select pg_temp.login(:admin);
select public.set_messaging_mode(:school, 'closed', array['teachers'], null);
select pg_temp.login(:parent1);
select is(public.can_post_in_thread(:group_ps), false,
  'once the school closes the channel, the parent may no longer write in the class group');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('messages', %L)$$,
         :school || '/' || :group_ps || '/encore.jpg'),
  '42501', null, 'and the photo is refused at the door of the bucket, not after the upload');

select * from finish();
rollback;
