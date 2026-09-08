-- ─────────────────────────────────────────────────────────────────────────────
-- Kesher demo seed — ENTIRELY FICTIONAL (brief §14). Deterministic ids so the
-- RLS tests and the e2e flows can reference them:
--   school            00000000-0000-4000-8000-000000000001
--   school year       00000000-0000-4000-8000-000000000010
--   levels            00000000-0000-4000-8000-0000000001NN   (NN = 01 TPS … 09 CM2)
--   classes           00000000-0000-4000-8000-0000000002NN   (NN = 01 … 06)
--   admin/staff/super a0000000-0000-4000-8000-0000000000NN   (01 admin, 02 staff, 03 super admin)
--   teachers          b0000000-0000-4000-8000-0000000000NN   (01 … 12)
--   guardians (users) c0000000-0000-4000-8000-00000FFF00PP   (family FFF, PP = 01/02 parents, 03 guardian)
--   students          d0000000-0000-4000-8000-00000FFF00SS   (family FFF, child SS)
--   families          e0000000-0000-4000-8000-000000000FFF
-- Demo accounts (password "demo-password" for local development only):
--   admin@demo.local, staff@demo.local, superadmin@demo.local, teacher-ps@demo.local,
--   teacher-NN@demo.local, parent-1@demo.local (family 001, 2 children), parent-en@demo.local
--   (family 002, English), parent-FFF-PP@demo.local, guardian-FFF@demo.local.
-- ─────────────────────────────────────────────────────────────────────────────

-- helpers ---------------------------------------------------------------------
create or replace function pg_temp.uid(prefix text, n int)
returns uuid language sql immutable as $$
  select (prefix || '0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

create or replace function pg_temp.person_uid(prefix text, family int, member int)
returns uuid language sql immutable as $$
  select (prefix || '0000000-0000-4000-8000-00000' || lpad(family::text, 3, '0') || '00' || lpad(member::text, 2, '0'))::uuid;
$$;

create or replace function pg_temp.create_user(
  id uuid, email text, first_name text, last_name text, locale text default 'fr', phone text default null
) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, phone, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, phone,
    extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('first_name', first_name, 'last_name', last_name, 'locale', locale),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), id,
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
    'email', id::text, now(), now(), now()
  );
  -- the on_auth_user_created trigger created the profile; make sure names are set
  update public.profiles set first_name = create_user.first_name, last_name = create_user.last_name, locale = create_user.locale, phone = create_user.phone
  where profiles.id = create_user.id;
end
$$;

-- school ----------------------------------------------------------------------
insert into public.schools (id, slug, name, city, address, timezone, locale_default, modules, latitude, longitude)
values (
  pg_temp.uid('0', 1), 'abravanel-neuilly', 'École Abravanel Neuilly', 'Neuilly-sur-Seine',
  '203 avenue Achille Peretti, 92200 Neuilly-sur-Seine', 'Europe/Paris', 'fr',
  '{"announcements": true, "classes": true, "messaging": true, "agenda": true, "community": true, "assessments": {"scores": false}, "directory": true, "marketplace": true}'::jsonb,
  48.8847, 2.2686
);

insert into public.school_years (id, school_id, label, starts_on, ends_on, is_current)
values (pg_temp.uid('0', 16), pg_temp.uid('0', 1), '2026-2027', '2026-09-01', '2027-07-06', true);

insert into public.levels (id, school_id, code, label_fr, label_en, sort_order)
select pg_temp.uid('0', 256 + i), pg_temp.uid('0', 1), code, label_fr, label_en, i
from (values
  (1, 'TPS'::public.level_code, 'Toute petite section', 'Pre-nursery'),
  (2, 'PS', 'Petite section', 'Nursery'),
  (3, 'MS', 'Moyenne section', 'Lower kindergarten'),
  (4, 'GS', 'Grande section', 'Upper kindergarten'),
  (5, 'CP', 'CP', 'Year 1'),
  (6, 'CE1', 'CE1', 'Year 2'),
  (7, 'CE2', 'CE2', 'Year 3'),
  (8, 'CM1', 'CM1', 'Year 4'),
  (9, 'CM2', 'CM2', 'Year 5')
) as l (i, code, label_fr, label_en);

-- classes: TPS-PS Coquelicots, PS Tournesols, MS Bleuets, GS Lavandes, CP Oliviers, CE1 Cèdres
insert into public.classes (id, school_id, school_year_id, level_id, name, room, capacity)
select pg_temp.uid('0', 512 + i), pg_temp.uid('0', 1), pg_temp.uid('0', 16), pg_temp.uid('0', 256 + level_i), name, room, 26
from (values
  (1, 1, 'TPS-PS Coquelicots', 'Salle 1'),
  (2, 2, 'PS Tournesols', 'Salle 2'),
  (3, 3, 'MS Bleuets', 'Salle 3'),
  (4, 4, 'GS Lavandes', 'Salle 4'),
  (5, 5, 'CP Oliviers', 'Salle 11'),
  (6, 6, 'CE1 Cèdres', 'Salle 12')
) as c (i, level_i, name, room);

-- staff accounts ----------------------------------------------------------------
select pg_temp.create_user(pg_temp.uid('a', 1), 'admin@demo.local', 'Directrice', 'Démo', 'fr', '+33600000001');
select pg_temp.create_user(pg_temp.uid('a', 2), 'staff@demo.local', 'Secrétariat', 'Démo', 'fr', '+33600000002');
select pg_temp.create_user(pg_temp.uid('a', 3), 'superadmin@demo.local', 'Porteur', 'Projet', 'fr', null);

insert into public.memberships (user_id, school_id, role, status, accepted_at) values
  (pg_temp.uid('a', 1), pg_temp.uid('0', 1), 'school_admin', 'active', now()),
  (pg_temp.uid('a', 2), pg_temp.uid('0', 1), 'staff', 'active', now()),
  (pg_temp.uid('a', 3), pg_temp.uid('0', 1), 'super_admin', 'active', now());

-- teachers (fictional generic first names) -------------------------------------
do $$
declare
  first_names text[] := array['Léa', 'Noa', 'Sarah', 'Myriam', 'Hanna', 'Rachel', 'Judith', 'Esther', 'Naomi', 'Tamar', 'Emily', 'David'];
  emails text[] := array['teacher-01', 'teacher-ps', 'teacher-03', 'teacher-04', 'teacher-05', 'teacher-06', 'teacher-07', 'teacher-08', 'teacher-09', 'teacher-10', 'teacher-en', 'teacher-kodesh'];
  i int;
begin
  for i in 1..12 loop
    perform pg_temp.create_user(pg_temp.uid('b', i), emails[i] || '@demo.local', first_names[i], 'Enseignant' || i, case when i = 11 then 'en' else 'fr' end);
    insert into public.memberships (user_id, school_id, role, status, accepted_at)
    values (pg_temp.uid('b', i), pg_temp.uid('0', 1), 'teacher', 'active', now());
  end loop;
  -- main teachers 01..06 on classes 01..06
  for i in 1..6 loop
    insert into public.class_teachers (class_id, user_id, role) values (pg_temp.uid('0', 512 + i), pg_temp.uid('b', i), 'main');
  end loop;
  -- assistants (ATSEM) 07..10 on the four nursery classes
  for i in 1..4 loop
    insert into public.class_teachers (class_id, user_id, role) values (pg_temp.uid('0', 512 + i), pg_temp.uid('b', 6 + i), 'assistant');
  end loop;
  -- English specialist and Kodesh teacher on every class
  for i in 1..6 loop
    insert into public.class_teachers (class_id, user_id, role, subject) values (pg_temp.uid('0', 512 + i), pg_temp.uid('b', 11), 'specialist', 'Anglais');
    insert into public.class_teachers (class_id, user_id, role, subject) values (pg_temp.uid('0', 512 + i), pg_temp.uid('b', 12), 'specialist', 'Kodesh');
  end loop;
end
$$;

-- 60 families ---------------------------------------------------------------------
-- 001: parent-1@demo.local, 2 children (PS Tournesols + CP Oliviers)
-- 002, 015, 030: English-speaking (locale en)
-- 003, 011, 022, 033, 044: separated parents (two households) ; 044 parent 02 has a court restriction
-- 005, 018: an extra read-only guardian (grand-parent)
-- 007, 013, 019, 025, 031: two children
do $$
declare
  family_names text[] := array[
    'Aouizerate', 'Benhamou', 'Cohen', 'Dahan', 'Elbaz', 'Fitoussi', 'Gabay', 'Haddad', 'Illouz', 'Journo',
    'Kalfon', 'Levy', 'Malka', 'Nahon', 'Ohayon', 'Perez', 'Quintana', 'Roubache', 'Sebbag', 'Toledano',
    'Uzan', 'Vidal', 'Wahnich', 'Xerri', 'Yaïche', 'Zerbib', 'Amar', 'Bitton', 'Chetrit', 'Dayan',
    'Elkaïm', 'Fellous', 'Guedj', 'Hazan', 'Israel', 'Jaoui', 'Karsenty', 'Lellouche', 'Mimoun', 'Nakache',
    'Obadia', 'Partouche', 'Rahmani', 'Saada', 'Taieb', 'Ultan', 'Vaknin', 'Weil', 'Yohana', 'Zagouri',
    'Abitbol', 'Boukris', 'Chemla', 'Darmon', 'Ettedgui', 'Fried', 'Gozlan', 'Hayat', 'Ifrah', 'Joseph'];
  mothers text[] := array['Sarah', 'Léa', 'Rachel', 'Myriam', 'Déborah', 'Esther', 'Judith', 'Noa', 'Ilana', 'Yaël', 'Emma', 'Chloé'];
  fathers text[] := array['David', 'Samuel', 'Jonathan', 'Raphaël', 'Gabriel', 'Nathan', 'Michaël', 'Ariel', 'Daniel', 'Elie', 'Thomas', 'Adam'];
  kids text[] := array['Eden', 'Liam', 'Maya', 'Noam', 'Talia', 'Ethan', 'Léa', 'Ilan', 'Shirel', 'Yaël', 'Adam', 'Elior', 'Lior', 'Naomi', 'Sacha', 'Ava', 'Rafael', 'Mia', 'Eliott', 'Romy'];
  f int;
  child int;
  nb_children int;
  class_i int;
  student_id uuid;
  student_no int := 0;
  locale text;
  email_base text;
  is_separated boolean;
begin
  for f in 1..60 loop
    locale := case when f in (2, 15, 30) then 'en' else 'fr' end;
    is_separated := f in (3, 11, 22, 33, 44);
    insert into public.families (id, school_id, name) values (pg_temp.uid('e', f), pg_temp.uid('0', 1), 'Famille ' || family_names[f]);

    -- parents
    email_base := case when f = 1 then 'parent-1' when f = 2 then 'parent-en' else 'parent-' || lpad(f::text, 3, '0') || '-01' end;
    perform pg_temp.create_user(pg_temp.person_uid('c', f, 1), email_base || '@demo.local', mothers[(f % 12) + 1], family_names[f], locale, '+3361' || lpad(f::text, 7, '0'));
    perform pg_temp.create_user(pg_temp.person_uid('c', f, 2), 'parent-' || lpad(f::text, 3, '0') || '-02@demo.local', fathers[(f % 12) + 1], family_names[f], locale, '+3362' || lpad(f::text, 7, '0'));
    insert into public.memberships (user_id, school_id, role, status, accepted_at) values
      (pg_temp.person_uid('c', f, 1), pg_temp.uid('0', 1), 'parent', 'active', now()),
      (pg_temp.person_uid('c', f, 2), pg_temp.uid('0', 1), 'parent', (case when f > 50 then 'invited' else 'active' end)::public.membership_status, case when f > 50 then null else now() end);

    -- optional read-only guardian
    if f in (5, 18) then
      perform pg_temp.create_user(pg_temp.person_uid('c', f, 3), 'guardian-' || lpad(f::text, 3, '0') || '@demo.local', 'Mamie', family_names[f], locale, null);
      insert into public.memberships (user_id, school_id, role, status, accepted_at)
      values (pg_temp.person_uid('c', f, 3), pg_temp.uid('0', 1), 'guardian', 'active', now());
    end if;

    -- children
    nb_children := case when f in (1, 7, 13, 19, 25, 31) then 2 else 1 end;
    for child in 1..nb_children loop
      student_no := student_no + 1;
      student_id := pg_temp.person_uid('d', f, child);
      class_i := case
        when f = 1 and child = 1 then 2   -- parent-1: PS Tournesols
        when f = 1 and child = 2 then 5   -- parent-1: CP Oliviers
        else ((student_no - 1) % 6) + 1
      end;
      insert into public.students (id, school_id, family_id, first_name, last_name, birth_date, image_rights_signed_at, allergies_note)
      values (
        student_id, pg_temp.uid('0', 1), pg_temp.uid('e', f), kids[((f + child) % 20) + 1], family_names[f],
        (date '2026-09-01' - make_interval(years => 2 + class_i, days => (f * 7) % 300))::date,
        case when f % 4 = 0 then null else now() end,
        case when f % 9 = 0 then 'Allergie aux arachides (PAI)' else null end
      );
      insert into public.enrollments (student_id, class_id, school_year_id, joined_on)
      values (student_id, pg_temp.uid('0', 512 + class_i), pg_temp.uid('0', 16), '2026-09-01');

      insert into public.student_guardians (student_id, user_id, relation, is_primary, can_view_grades, can_message, receives_notifications, access_blocked, access_blocked_reason) values
        (student_id, pg_temp.person_uid('c', f, 1), 'mother', true, true, true, true, false, null),
        (student_id, pg_temp.person_uid('c', f, 2), 'father', false, true, true, not is_separated or f <> 44, f = 44, case when f = 44 then 'Décision de justice du 2026-06-15 (fictive)' else null end);
      if f in (5, 18) then
        insert into public.student_guardians (student_id, user_id, relation, is_primary, can_view_grades, can_message, receives_notifications)
        values (student_id, pg_temp.person_uid('c', f, 3), 'guardian', false, false, false, true);
      end if;
    end loop;

    -- directory opt-in for a third of the families (never for separated ones)
    if f % 3 = 0 and not is_separated then
      insert into public.directory_optins (user_id, school_id, show_phone, show_email, show_children_names, show_address, address)
      values (pg_temp.person_uid('c', f, 1), pg_temp.uid('0', 1), true, f % 2 = 0, true, false, null);
    end if;
  end loop;
end
$$;

-- legal texts ---------------------------------------------------------------------
insert into public.legal_documents (id, school_id, kind, version, locale, body_md) values
  (pg_temp.uid('f', 1), pg_temp.uid('0', 1), 'terms', '1.0', 'fr', '# Conditions générales d''utilisation (texte de démonstration)\n\nTexte fictif à remplacer par la direction.'),
  (pg_temp.uid('f', 2), pg_temp.uid('0', 1), 'charter', '1.0', 'fr', '# Charte de bonne conduite (texte de démonstration)\n\nRespect, bienveillance, confidentialité.'),
  (pg_temp.uid('f', 3), pg_temp.uid('0', 1), 'privacy', '1.0', 'fr', '# Politique de confidentialité (texte de démonstration)\n\nDonnées hébergées en Union européenne.');

-- assessment periods and skill catalog (PS, MS, GS) ---------------------------------
insert into public.assessment_periods (id, school_id, school_year_id, label, starts_on, ends_on, sort_order) values
  (pg_temp.uid('0', 768 + 1), pg_temp.uid('0', 1), pg_temp.uid('0', 16), 'Période 1', '2026-09-01', '2026-12-18', 1),
  (pg_temp.uid('0', 768 + 2), pg_temp.uid('0', 1), pg_temp.uid('0', 16), 'Période 2', '2027-01-04', '2027-04-02', 2),
  (pg_temp.uid('0', 768 + 3), pg_temp.uid('0', 1), pg_temp.uid('0', 16), 'Période 3', '2027-04-19', '2027-07-06', 3);

do $$
declare
  level_i int;
  domain record;
  skill record;
  n int := 0;
begin
  for level_i in 2..4 loop  -- PS, MS, GS
    for domain in select * from (values
      ('langage', 'Mobiliser le langage', 'Language'),
      ('motricite', 'Agir, s''exprimer, comprendre à travers l''activité physique', 'Physical activity'),
      ('arts', 'Activités artistiques', 'Arts'),
      ('pensee', 'Outils pour structurer sa pensée', 'Structuring thinking'),
      ('monde', 'Explorer le monde', 'Exploring the world'),
      ('anglais', 'Anglais', 'English'),
      ('kodesh', 'Kodesh', 'Kodesh')
    ) as d (code, label_fr, label_en) loop
      for skill in select * from (values
        (1, 'Comprendre les consignes', 'Understands instructions'),
        (2, 'Participer aux activités', 'Takes part in activities'),
        (3, 'Progresser en autonomie', 'Works independently')
      ) as s (i, label_fr, label_en) loop
        n := n + 1;
        insert into public.skill_catalog (id, school_id, level_id, domain, code, label_fr, label_en, sort_order)
        values (pg_temp.uid('0', 1024 + n), pg_temp.uid('0', 1), pg_temp.uid('0', 256 + level_i), domain.label_fr,
                domain.code || '-' || skill.i, domain.label_fr || ' · ' || skill.label_fr, domain.label_en || ' · ' || skill.label_en, n);
      end loop;
    end loop;
  end loop;
end
$$;

-- period 1 assessments for PS / MS / GS students (classes 2, 3, 4), published & visible
insert into public.assessments (school_id, class_id, student_id, teacher_id, period_id, skill_id, level, comment, visible_to_parents, published_at)
select pg_temp.uid('0', 1), e.class_id, e.student_id, ct.user_id, pg_temp.uid('0', 768 + 1), sk.id,
  (array['not_yet', 'in_progress', 'acquired', 'mastered']::public.assessment_level[])[1 + ((abs(hashtext(e.student_id::text || sk.code)) % 4))],
  case when abs(hashtext(sk.code || e.student_id::text)) % 5 = 0 then 'Beaux progrès ce trimestre.' else null end,
  true, now() - interval '2 days'
from public.enrollments e
join public.classes c on c.id = e.class_id
join public.class_teachers ct on ct.class_id = c.id and ct.role = 'main'
join public.skill_catalog sk on sk.level_id = c.level_id
where c.id in (pg_temp.uid('0', 512 + 2), pg_temp.uid('0', 512 + 3), pg_temp.uid('0', 512 + 4));

-- announcements (10) ---------------------------------------------------------------
insert into public.announcements (id, school_id, author_id, audience, target_ids, title, body_md, pinned, requires_ack, published_at, template) values
  (pg_temp.uid('0', 1280 + 1), pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'school', '{}', 'Bienvenue pour cette nouvelle année scolaire', 'Toute l''équipe est heureuse de vous retrouver. Les horaires d''accueil restent inchangés : 8 h 20 – 8 h 45.', true, true, now() - interval '20 days', 'circular'),
  (pg_temp.uid('0', 1280 + 2), pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'school', '{}', 'Roch Hachana : jours sans école', 'L''école sera fermée les 12 et 13 septembre. Chana tova à toutes les familles.', true, false, now() - interval '12 days', 'holiday'),
  (pg_temp.uid('0', 1280 + 3), pg_temp.uid('0', 1), pg_temp.uid('a', 2), 'level', array[pg_temp.uid('0', 256 + 2), pg_temp.uid('0', 256 + 3), pg_temp.uid('0', 256 + 4)], 'Réunion de rentrée des classes maternelles', 'Rendez-vous lundi 15 septembre à 18 h 30 dans la salle polyvalente. Merci de confirmer votre présence dans l''agenda.', false, true, now() - interval '10 days', 'reminder'),
  (pg_temp.uid('0', 1280 + 4), pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'class', array[pg_temp.uid('0', 512 + 2)], 'PS Tournesols : photo de classe', 'La photo de classe aura lieu le 1er octobre. Tenue soignée bienvenue.', false, false, now() - interval '8 days', null),
  (pg_temp.uid('0', 1280 + 5), pg_temp.uid('0', 1), pg_temp.uid('a', 2), 'class', array[pg_temp.uid('0', 512 + 6)], 'CE1 Cèdres : sortie au musée', 'Sortie le 17 novembre. L''autorisation est à signer dans l''espace Documents.', false, true, now() - interval '6 days', 'outing'),
  (pg_temp.uid('0', 1280 + 6), pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'school', '{}', 'Menus de la cantine : septembre', 'Les menus du mois sont disponibles dans la bibliothèque de documents.', false, false, now() - interval '5 days', null),
  (pg_temp.uid('0', 1280 + 7), pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'school', '{}', 'Yom Kippour : fermeture de l''école', 'L''école sera fermée le 21 septembre.', false, false, now() - interval '4 days', 'holiday'),
  (pg_temp.uid('0', 1280 + 8), pg_temp.uid('0', 1), pg_temp.uid('a', 2), 'level', array[pg_temp.uid('0', 256 + 5), pg_temp.uid('0', 256 + 6)], 'Élémentaire : liste des fournitures mise à jour', 'Un cahier 24 × 32 supplémentaire est demandé pour les CP et CE1.', false, false, now() - interval '3 days', null),
  (pg_temp.uid('0', 1280 + 9), pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'custom', array[pg_temp.person_uid('c', 1, 1)], 'Message personnel : rendez-vous avec la direction', 'Merci de passer au secrétariat pour finaliser le dossier d''inscription.', false, true, now() - interval '2 days', null),
  (pg_temp.uid('0', 1280 + 10), pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'school', '{}', 'Souccot : décoration de la souccah', 'Les familles sont invitées jeudi 24 septembre à 16 h pour décorer la souccah avec les enfants.', false, false, now() - interval '1 day', 'holiday');

-- reads / acks by some parents on the first announcement
insert into public.announcement_reads (announcement_id, user_id, read_at, acked_at)
select pg_temp.uid('0', 1280 + 1), m.user_id, now() - interval '19 days', case when row_number() over () % 3 <> 0 then now() - interval '19 days' else null end
from public.memberships m
where m.role = 'parent' and m.status = 'active'
  and m.user_id = any (array(select pg_temp.person_uid('c', f, p) from generate_series(1, 40) as f, generate_series(1, 2) as p));

-- class posts: 3 weeks per class ------------------------------------------------------
do $$
declare
  class_i int;
  week int;
  author uuid;
  cls uuid;
  n int := 0;
begin
  for class_i in 1..6 loop
    cls := pg_temp.uid('0', 512 + class_i);
    author := pg_temp.uid('b', class_i);
    for week in 0..2 loop
      n := n + 1;
      insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, published_at)
      values (pg_temp.uid('0', 1536 + n), pg_temp.uid('0', 1), cls, author, 'journal',
        'Cahier de vie — semaine ' || (week + 1),
        'Cette semaine nous avons découvert la classe, chanté et jardiné. Les photos arrivent bientôt.',
        now() - make_interval(days => 20 - week * 7));
      n := n + 1;
      insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, subject, due_on, published_at)
      values (pg_temp.uid('0', 1536 + n), pg_temp.uid('0', 1), cls, author, 'homework',
        case when class_i <= 4 then 'À préparer : apporter une photo de famille' else 'Devoirs : lecture page ' || (10 + week * 4) end,
        case when class_i <= 4 then 'Pour le cahier de vie, merci d''apporter une photo de famille dans une enveloppe.' else 'Lire le texte et préparer trois questions.' end,
        case when class_i <= 4 then 'Langage' else 'Français' end,
        (current_date + (4 - week * 7)),
        now() - make_interval(days => 19 - week * 7));
      n := n + 1;
      insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, published_at)
      values (pg_temp.uid('0', 1536 + n), pg_temp.uid('0', 1), cls, author, 'info',
        'Rappel : doudou et gourde', 'Merci de marquer le nom de votre enfant sur la gourde et le doudou.',
        now() - make_interval(days => 17 - week * 7));
    end loop;
    -- English specialist post, visible to parents
    n := n + 1;
    insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, subject, published_at)
    values (pg_temp.uid('0', 1536 + n), pg_temp.uid('0', 1), cls, pg_temp.uid('b', 11), 'info', 'English corner: colours and numbers', 'This week we sang the rainbow song and counted to ten.', 'Anglais', now() - interval '5 days');
    -- staff-only note
    n := n + 1;
    insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, visibility, published_at)
    values (pg_temp.uid('0', 1536 + n), pg_temp.uid('0', 1), cls, author, 'info', 'Note interne : commande de matériel', 'Prévoir la commande de peinture pour octobre.', 'staff', now() - interval '4 days');
    -- one draft (not published)
    n := n + 1;
    insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, published_at)
    values (pg_temp.uid('0', 1536 + n), pg_temp.uid('0', 1), cls, author, 'reminder', 'Brouillon : sortie de fin de trimestre', 'À compléter.', null);
  end loop;
end
$$;

-- individual notes for parent-1's first child (PS Tournesols)
insert into public.individual_notes (id, school_id, student_id, author_id, body_md, visibility, kind, created_at) values
  (pg_temp.uid('0', 1792 + 1), pg_temp.uid('0', 1), pg_temp.person_uid('d', 1, 1), pg_temp.uid('b', 2), 'Très belle participation ce matin lors du temps de langage.', 'parents', 'praise', now() - interval '3 days'),
  (pg_temp.uid('0', 1792 + 2), pg_temp.uid('0', 1), pg_temp.person_uid('d', 1, 1), pg_temp.uid('b', 2), 'Point à surveiller : fatigue en fin de matinée.', 'staff', 'concern', now() - interval '2 days');

-- events (8) -----------------------------------------------------------------------
insert into public.events (id, school_id, scope, target_ids, title, description_md, starts_at, ends_at, all_day, location, kind, requires_rsvp, capacity, rsvp_deadline, created_by) values
  (pg_temp.uid('0', 2048 + 1), pg_temp.uid('0', 1), 'school', '{}', 'Roch Hachana : pommes et miel', 'Petite fête dans chaque classe avant les jours de fête.', '2026-09-10 15:00+02', '2026-09-10 16:00+02', false, 'Dans les classes', 'celebration', false, null, null, pg_temp.uid('a', 1)),
  (pg_temp.uid('0', 2048 + 2), pg_temp.uid('0', 1), 'school', '{}', 'Roch Hachana (école fermée)', 'Chana tova !', '2026-09-12', '2026-09-13', true, null, 'holiday', false, null, null, pg_temp.uid('a', 1)),
  (pg_temp.uid('0', 2048 + 3), pg_temp.uid('0', 1), 'level', array[pg_temp.uid('0', 256 + 2), pg_temp.uid('0', 256 + 3), pg_temp.uid('0', 256 + 4)], 'Réunion de rentrée des classes maternelles', 'Présentation de l''année, de l''équipe et du projet pédagogique.', '2026-09-15 18:30+02', '2026-09-15 20:00+02', false, 'Salle polyvalente', 'meeting', true, 80, '2026-09-14 12:00+02', pg_temp.uid('a', 1)),
  (pg_temp.uid('0', 2048 + 4), pg_temp.uid('0', 1), 'class', array[pg_temp.uid('0', 512 + 2)], 'Kabbalat Shabbat de la classe', 'Les familles sont invitées à partager le kabbalat Shabbat de la classe.', '2026-09-18 16:00+02', '2026-09-18 17:00+02', false, 'Salle des Tournesols', 'celebration', true, 40, '2026-09-17 12:00+02', pg_temp.uid('b', 2)),
  (pg_temp.uid('0', 2048 + 5), pg_temp.uid('0', 1), 'school', '{}', 'Souccot : décoration de la souccah', 'Décoration avec les enfants, goûter offert.', '2026-09-24 16:00+02', '2026-09-24 17:30+02', false, 'Cour', 'celebration', false, null, null, pg_temp.uid('a', 1)),
  (pg_temp.uid('0', 2048 + 6), pg_temp.uid('0', 1), 'level', array[pg_temp.uid('0', 256 + 2)], 'Sortie au jardin pédagogique', 'Sortie des PS avec accompagnateurs. Autorisation à signer.', '2026-10-06 09:30+02', '2026-10-06 11:30+02', false, 'Jardin pédagogique', 'outing', true, null, '2026-10-02 18:00+02', pg_temp.uid('a', 2)),
  (pg_temp.uid('0', 2048 + 7), pg_temp.uid('0', 1), 'class', array[pg_temp.uid('0', 512 + 6)], 'Sortie au musée', 'Sortie des CE1. Autorisation à signer.', '2026-11-17 09:00+01', '2026-11-17 12:30+01', false, 'Musée (Paris)', 'outing', true, null, '2026-11-12 18:00+01', pg_temp.uid('a', 2)),
  (pg_temp.uid('0', 2048 + 8), pg_temp.uid('0', 1), 'school', '{}', 'Hanouka : allumage et beignets', 'Allumage des bougies avec les familles.', '2026-12-08 17:00+01', '2026-12-08 18:30+01', false, 'Salle polyvalente', 'celebration', true, 150, '2026-12-06 12:00+01', pg_temp.uid('a', 1));

insert into public.event_slots (id, event_id, label, needed, sort_order) values
  (pg_temp.uid('0', 2304 + 1), pg_temp.uid('0', 2048 + 4), 'Apporter la hallah', 1, 1),
  (pg_temp.uid('0', 2304 + 2), pg_temp.uid('0', 2048 + 4), 'Apporter des fruits', 2, 2),
  (pg_temp.uid('0', 2304 + 3), pg_temp.uid('0', 2048 + 6), 'Accompagner la sortie', 3, 1),
  (pg_temp.uid('0', 2304 + 4), pg_temp.uid('0', 2048 + 7), 'Accompagner la sortie', 4, 1);

insert into public.event_rsvps (event_id, user_id, status, guests_count)
select pg_temp.uid('0', 2048 + 3), m.user_id, (array['yes', 'no', 'maybe']::public.rsvp_status[])[1 + (row_number() over () % 3)], 1
from public.memberships m
where m.role = 'parent' and m.status = 'active'
  and m.user_id = any (array(select pg_temp.person_uid('c', f, p) from generate_series(1, 30) as f, generate_series(1, 2) as p));

insert into public.event_slot_signups (slot_id, user_id) values
  (pg_temp.uid('0', 2304 + 1), pg_temp.person_uid('c', 1, 1)),
  (pg_temp.uid('0', 2304 + 2), pg_temp.person_uid('c', 7, 1));

-- documents ------------------------------------------------------------------------
insert into public.document_folders (id, school_id, name, sort_order) values
  (pg_temp.uid('0', 2560 + 1), pg_temp.uid('0', 1), 'Règlement', 1),
  (pg_temp.uid('0', 2560 + 2), pg_temp.uid('0', 1), 'Circulaires', 2),
  (pg_temp.uid('0', 2560 + 3), pg_temp.uid('0', 1), 'Menus', 3),
  (pg_temp.uid('0', 2560 + 4), pg_temp.uid('0', 1), 'Listes de fournitures', 4),
  (pg_temp.uid('0', 2560 + 5), pg_temp.uid('0', 1), 'Autorisations', 5);

insert into public.documents (id, school_id, folder_id, title, storage_path, audience, target_ids, requires_signature, signature_per_student, published_at, created_by) values
  (pg_temp.uid('0', 2816 + 1), pg_temp.uid('0', 1), pg_temp.uid('0', 2560 + 1), 'Règlement intérieur 2026-2027 (démo)', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000b01/reglement.pdf', 'school', '{}', true, false, now() - interval '20 days', pg_temp.uid('a', 1)),
  (pg_temp.uid('0', 2816 + 2), pg_temp.uid('0', 1), pg_temp.uid('0', 2560 + 5), 'Droit à l''image 2026-2027', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000b02/droit-image.pdf', 'school', '{}', true, true, now() - interval '20 days', pg_temp.uid('a', 1)),
  (pg_temp.uid('0', 2816 + 3), pg_temp.uid('0', 1), pg_temp.uid('0', 2560 + 5), 'Autorisation de sortie : jardin pédagogique (PS)', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000b03/sortie-jardin.pdf', 'level', array[pg_temp.uid('0', 256 + 2)], true, true, now() - interval '6 days', pg_temp.uid('a', 2)),
  (pg_temp.uid('0', 2816 + 4), pg_temp.uid('0', 1), pg_temp.uid('0', 2560 + 5), 'Autorisation de sortie : musée (CE1)', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000b04/sortie-musee.pdf', 'class', array[pg_temp.uid('0', 512 + 6)], true, true, now() - interval '6 days', pg_temp.uid('a', 2)),
  (pg_temp.uid('0', 2816 + 5), pg_temp.uid('0', 1), pg_temp.uid('0', 2560 + 3), 'Menus de septembre', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000b05/menus-09.pdf', 'school', '{}', false, false, now() - interval '5 days', pg_temp.uid('a', 2)),
  (pg_temp.uid('0', 2816 + 6), pg_temp.uid('0', 1), pg_temp.uid('0', 2560 + 4), 'Liste de fournitures CP', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000b06/fournitures-cp.pdf', 'level', array[pg_temp.uid('0', 256 + 5)], false, false, now() - interval '25 days', pg_temp.uid('a', 2));

-- image rights signatures mirror students.image_rights_signed_at
insert into public.document_signatures (document_id, user_id, student_id, signed_at)
select pg_temp.uid('0', 2816 + 2), sg.user_id, s.id, s.image_rights_signed_at
from public.students s join public.student_guardians sg on sg.student_id = s.id and sg.is_primary
where s.image_rights_signed_at is not null;

-- threads: official channel + parents group per class ----------------------------------
do $$
declare
  class_i int;
  cls uuid;
  official uuid;
  grp uuid;
begin
  for class_i in 1..6 loop
    cls := pg_temp.uid('0', 512 + class_i);
    official := pg_temp.uid('0', 3072 + class_i);
    grp := pg_temp.uid('0', 3072 + 16 + class_i);
    insert into public.threads (id, school_id, kind, class_id, title, created_by, allow_replies)
    values (official, pg_temp.uid('0', 1), 'class_official', cls, 'Informations de la classe', pg_temp.uid('b', class_i), false);
    insert into public.threads (id, school_id, kind, class_id, title, created_by, allow_replies)
    values (grp, pg_temp.uid('0', 1), 'class_group', cls, 'Parents de la classe', pg_temp.uid('b', class_i), true);
    -- teachers moderate both threads
    insert into public.thread_members (thread_id, user_id, role)
    select t.id, ct.user_id, 'moderator'::public.thread_member_role
    from public.class_teachers ct cross join (values (official), (grp)) as t (id)
    where ct.class_id = cls;
    -- active guardians of enrolled students are members (parents, not read-only guardians)
    insert into public.thread_members (thread_id, user_id, role)
    select distinct t.id, sg.user_id, 'member'::public.thread_member_role
    from public.enrollments e
    join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
    join public.memberships m on m.user_id = sg.user_id and m.school_id = pg_temp.uid('0', 1) and m.status = 'active' and m.role = 'parent'
    cross join (values (official), (grp)) as t (id)
    where e.class_id = cls
    on conflict do nothing;
  end loop;
end
$$;

-- a few messages in the PS Tournesols threads
insert into public.messages (id, thread_id, author_id, body, created_at) values
  (pg_temp.uid('0', 3328 + 1), pg_temp.uid('0', 3072 + 2), pg_temp.uid('b', 2), 'Bonjour à toutes et à tous, bienvenue dans le canal officiel de la classe. Les informations importantes seront publiées ici.', now() - interval '15 days'),
  (pg_temp.uid('0', 3328 + 2), pg_temp.uid('0', 3072 + 16 + 2), pg_temp.person_uid('c', 1, 1), 'Bonjour ! Quelqu''un aurait-il retrouvé un bonnet bleu dans le vestiaire ?', now() - interval '3 days'),
  (pg_temp.uid('0', 3328 + 3), pg_temp.uid('0', 3072 + 16 + 2), pg_temp.person_uid('c', 7, 1), 'Oui, je l''ai déposé au secrétariat ce matin.', now() - interval '3 days' + interval '2 hours'),
  (pg_temp.uid('0', 3328 + 4), pg_temp.uid('0', 3072 + 16 + 2), pg_temp.person_uid('c', 1, 1), 'Merci beaucoup !', now() - interval '3 days' + interval '3 hours');

insert into public.message_reactions (message_id, user_id, emoji) values
  (pg_temp.uid('0', 3328 + 3), pg_temp.person_uid('c', 1, 1), '🙏');

-- a direct message between parent-1 and the PS teacher
insert into public.threads (id, school_id, kind, title, created_by) values
  (pg_temp.uid('0', 3072 + 40), pg_temp.uid('0', 1), 'dm', null, pg_temp.person_uid('c', 1, 1));
insert into public.thread_members (thread_id, user_id, role) values
  (pg_temp.uid('0', 3072 + 40), pg_temp.person_uid('c', 1, 1), 'member'),
  (pg_temp.uid('0', 3072 + 40), pg_temp.uid('b', 2), 'member');
insert into public.messages (id, thread_id, author_id, body, created_at) values
  (pg_temp.uid('0', 3328 + 5), pg_temp.uid('0', 3072 + 40), pg_temp.person_uid('c', 1, 1), 'Bonjour, serait-il possible de nous voir quelques minutes cette semaine ?', now() - interval '1 day'),
  (pg_temp.uid('0', 3328 + 6), pg_temp.uid('0', 3072 + 40), pg_temp.uid('b', 2), 'Bien sûr, jeudi à 16 h 30 vous conviendrait-il ?', now() - interval '20 hours');

-- community posts -----------------------------------------------------------------------
insert into public.community_posts (id, school_id, category, author_id, title, body, status, moderated_by, moderated_at) values
  (pg_temp.uid('0', 3584 + 1), pg_temp.uid('0', 1), 'carpool', pg_temp.person_uid('c', 9, 1), 'Covoiturage depuis Levallois le matin', 'Départ 8 h 05, deux places disponibles.', 'published', pg_temp.uid('a', 2), now() - interval '4 days'),
  (pg_temp.uid('0', 3584 + 2), pg_temp.uid('0', 1), 'lost_found', pg_temp.person_uid('c', 12, 1), 'Trouvé : une paire de lunettes enfant', 'Déposée au secrétariat.', 'published', pg_temp.uid('a', 2), now() - interval '2 days'),
  (pg_temp.uid('0', 3584 + 3), pg_temp.uid('0', 1), 'recommendation', pg_temp.person_uid('c', 21, 2), 'Recherche baby-sitter le mercredi', 'Pour deux enfants, de 12 h à 18 h.', 'pending', null, null);

-- audit trail example
insert into public.audit_log (school_id, actor_id, action, entity, entity_id, diff)
values (pg_temp.uid('0', 1), pg_temp.uid('a', 1), 'student_guardian.block', 'student_guardians', pg_temp.person_uid('d', 44, 1),
        '{"user_id": "c0000000-0000-4000-8000-000000440002", "access_blocked": true, "reason": "Décision de justice (fictive)"}'::jsonb);

-- cleanup helpers
drop function pg_temp.create_user(uuid, text, text, text, text, text);
drop function pg_temp.person_uid(text, int, int);
drop function pg_temp.uid(text, int);
