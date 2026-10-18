-- L'école test vivante (ADR-0077).
--
-- L'École test Kesher de la production a été remplie le 9 septembre, par le seed,
-- et jamais rejouée : ses dates relatives se sont figées ce jour-là. Six semaines
-- plus tard, ses devoirs tombaient tous fin août et début septembre, ses
-- conversations dataient d'un mois, et le cahier de texte d'un parent de test
-- s'ouvrait sur des semaines vides. Une démonstration ne montre rien de ce que
-- l'application fait quand une classe la fait vivre.
--
-- `refresh_test_school_content()` la fait vivre, et peut la refaire vivre chaque
-- jour (supabase/jobs/cron.sql). Pour chaque école marquée `modules.test` — et
-- aucune autre —, autour de la date du jour :
--
-- - un emploi du temps pour chaque classe qui n'en a pas ;
-- - des devoirs pour chaque jour de classe, de six semaines en arrière à huit
--   semaines en avant, rangés par matière selon l'emploi du temps (deux ou trois
--   par jour en élémentaire, deux par semaine en maternelle), et « faits » par la
--   plupart des élèves quand la date est passée ;
-- - un billet par semaine dans le cahier de vie, et un rappel une semaine sur deux ;
-- - des conversations : groupe des parents, canal officiel de la classe, messages
--   directs entre l'enseignante et des familles, et avec la direction ;
-- - des annonces, des événements à venir, les menus des semaines à venir, des mots
--   aux familles.
--
-- Trois règles tiennent le tout :
--
-- 1. **Rien de réel n'est touché.** Seules les écoles `modules @> '{"test": true}'`
--    sont lues et écrites ; le contenu est fictif, sans nom de personne réelle.
-- 2. **Rejouer ne double rien.** Chaque ligne reçoit un identifiant tiré de ce
--    qu'elle est (école, classe, date, rang) et s'insère avec `on conflict do
--    nothing` ; une conversation directe existante est reprise, pas recréée.
-- 3. **Personne n'est prévenu.** Les publications portent `notified_at` (le
--    répartiteur les ignore) ; les notifications que les déclencheurs créent pendant
--    l'appel sont supprimées, sauf celles des deux derniers jours, que les comptes
--    de test trouvent non lues — et aucune n'est jamais livrée par e-mail ou push.
--
-- Les vacances sont respectées : un jour couvert par un événement « vacances » de
-- l'école ou férié n'a pas de devoir, et le travail des vacances est donné pour le
-- jour de la rentrée.

-- ── Petits outils déterministes ─────────────────────────────────────────────────
create or replace function public.demo_id(key text)
returns uuid
language sql immutable
as $$
  select md5('kesher-test-school:' || key)::uuid;
$$;

create or replace function public.demo_pick(key text, n integer)
returns integer
language sql immutable
as $$
  select case when n <= 0 then 0
              else (('x' || substr(md5(key), 1, 8))::bit(32)::bigint % n)::integer end;
$$;

-- Un jour de classe : lundi, mardi, jeudi, vendredi — et le mercredi matin en
-- élémentaire —, hors vacances de l'école et jours fériés.
create or replace function public.demo_is_school_day(school uuid, d date, elementary boolean)
returns boolean
language sql stable
as $$
  select (extract(isodow from d) in (1, 2, 4, 5) or (elementary and extract(isodow from d) = 3))
     and to_char(d, 'MM-DD') not in ('01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25')
     and not exists (
       select 1 from public.events e
       where e.school_id = school and e.kind = 'holiday' and e.deleted_at is null
         and d between (e.starts_at at time zone 'Europe/Paris')::date
                   and coalesce(e.ends_at at time zone 'Europe/Paris', e.starts_at at time zone 'Europe/Paris')::date);
$$;

revoke all on function public.demo_id(text) from public, anon, authenticated;
revoke all on function public.demo_pick(text, integer) from public, anon, authenticated;
revoke all on function public.demo_is_school_day(uuid, date, boolean) from public, anon, authenticated;

-- ── Le remplissage ─────────────────────────────────────────────────────────────
create or replace function public.refresh_test_school_content(
  weeks_ahead integer default 8,
  weeks_back integer default 6
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  tz constant text := 'Europe/Paris';
  today date := (now() at time zone 'Europe/Paris')::date;
  first_day date;
  last_day date;
  sch record;
  cls record;
  slot record;
  d date;
  prev_day date;
  last_school_day date;
  i integer;
  k integer;
  n integer;
  affected integer;
  elementary boolean;
  level text;
  week_idx integer;
  subjects text[];
  subject text;
  tpl text;
  title text;
  body text;
  author uuid;
  main_teacher uuid;
  english_teacher uuid;
  kodesh_teacher uuid;
  post_id uuid;
  published timestamptz;
  official uuid;
  grp uuid;
  dm uuid;
  parents uuid[];
  parent_a uuid;
  parent_b uuid;
  parent_c uuid;
  child_name text;
  at_ts timestamptz;
  line text;
  who text;
  speaker uuid;
  director uuid;
  secretary uuid;
  paracha text;
  menu uuid;
  monday date;
  test_schools uuid[] := '{}';
  stats jsonb := jsonb_build_object(
    'timetable', 0, 'homework', 0, 'completions', 0, 'journal', 0, 'messages', 0,
    'threads', 0, 'announcements', 0, 'events', 0, 'menus', 0, 'notes', 0);

  -- Les bibliothèques de contenu : « titre|consigne ». Les accolades sont remplies plus bas.
  lib_fr_cp constant text[] := array[
    'Lire la page {page} du livre de lecture|Deux fois à voix haute en suivant avec le doigt, puis raconter l''histoire en une phrase.',
    'Relire les syllabes du son « {sound} »|Dans le cahier de sons. Cinq minutes suffisent, mais tous les soirs.',
    'Copier les trois mots du jour|Dans le cahier du soir, en attaché, sur la ligne : {words}.',
    'Poésie : « {poem} »|Savoir réciter la première strophe sans le cahier.',
    'Préparer la dictée de mots|Les mots de la semaine sont collés dans le cahier rouge : les épeler à voix haute.',
    'Lire le petit livre de la bibliothèque|Le rapporter dans la pochette rouge avant vendredi.'];
  lib_fr_ce constant text[] := array[
    'Lire le chapitre {n} de « {book} »|Puis répondre aux questions 1 à 3 sur le cahier de lecture.',
    'Conjuguer « {verb} » au présent|Les six personnes, sur le cahier d''exercices.',
    'Dictée préparée n° {n}|Apprendre l''orthographe des mots soulignés.',
    'Poésie : « {poem} »|Savoir réciter les deux premières strophes.',
    'Écrire trois phrases sur le week-end|Une majuscule au début, un point à la fin de chaque phrase.',
    'Lire la page {page} du manuel|Relever les mots inconnus et les chercher dans le dictionnaire.'];
  lib_math_cp constant text[] := array[
    'Fiche de calcul n° {n}|Les dix premières additions seulement.',
    'Compter de {step} en {step} jusqu''à {limit}|À voix haute, puis en l''écrivant sur l''ardoise.',
    'Réviser les doubles jusqu''à {limit}|Avec les cartes-nombres glissées dans le cahier.',
    'Problème du jour, page {page}|Faire un dessin pour trouver la réponse.',
    'Lire et écrire les nombres jusqu''à {limit}|Savoir les lire à voix haute et les écrire en chiffres.'];
  lib_math_ce constant text[] := array[
    'Apprendre la table de {table}|Dans l''ordre, puis dans le désordre.',
    'Fichier de mathématiques, page {page}|Exercices 1 et 2.',
    'Calcul mental : fiche {n}|Cinq minutes, pas plus.',
    'Poser les soustractions de la page {page}|Vérifier chaque résultat avec une addition.',
    'Problèmes de la semaine, n° {n}|Écrire la phrase réponse.'];
  lib_hebrew constant text[] := array[
    'Réviser les lettres {letters}|Les lire, puis les écrire trois fois chacune sur le cahier.',
    'Lire les syllabes de la page {page}|Avec les voyelles, deux fois, lentement.',
    'Écrire une ligne de chaque lettre : {letters}|Sur le cahier d''écriture, en respectant les interlignes.',
    'Apprendre le chant de la semaine|La feuille est dans la pochette verte.'];
  lib_kodesh constant text[] := array[
    'Raconter la paracha {paracha}|Raconter à la maison ce que nous avons appris cette semaine, puis faire un dessin.',
    'Préparer une question sur la paracha {paracha}|Une question à poser à la classe la semaine prochaine.',
    'Apprendre la berakha avant le goûter|À réciter en classe la semaine prochaine.'];
  lib_english constant text[] := array[
    'Learn the {theme} song|Chanter le refrain avec les gestes, comme en classe.',
    'Revise the words: {words_en}|Les dire à voix haute en montrant l''image.',
    'Draw and label your {thing}|Trois mots en anglais sur le dessin.'];
  lib_world constant text[] := array[
    'Apporter une feuille d''arbre pour l''herbier|Bien à plat dans un livre la veille.',
    'Observer le ciel trois soirs de suite|Noter sur la fiche : soleil, nuages ou pluie.',
    'Apporter un objet qui flotte|Pour l''expérience : un bouchon, une éponge, un jouet en plastique…',
    'Rapporter une photo de quand tu étais bébé|Pour notre frise du temps.'];
  lib_arts constant text[] := array[
    'Apporter des magazines à découper|Pour le grand collage de la classe.',
    'Apporter une boîte à chaussures vide|Nous fabriquerons des maisons.'];
  lib_sport constant text[] := array[
    'Tenue de sport et gourde|Baskets bien attachées, cheveux longs attachés aussi.'];
  lib_kinder constant text[] := array[
    'Langage|Chanter la comptine « {rhyme} »|Celle que nous apprenons en classe : les paroles sont dans le cahier de vie.',
    'Langage|Lire ensemble l''album « {album} »|Le livre est dans la pochette de bibliothèque, à rapporter vendredi.',
    'Langage|Raconter son week-end|Votre enfant pourra montrer un objet ou une photo à la classe.',
    'Découvrir le monde|Apporter une feuille ou un marron|Pour notre table d''automne.',
    'Découvrir le monde|Apporter un fruit de saison|Pour l''atelier dégustation.',
    'Arts plastiques|Apporter un rouleau d''essuie-tout vide|Pour le bricolage de la semaine.',
    'Hébreu|Chanter « {song_he} »|Le chant de la semaine, avec les gestes.'];
  lib_kinder_gs constant text[] := array[
    'Langage|Trouver des mots qui commencent par « {letter} »|Les dessiner ou les découper dans un magazine.',
    'Mathématiques|Trouver à la maison un objet rond|L''apporter pour notre musée des formes.',
    'Mathématiques|Compter les marches de l''escalier|Et venir nous dire combien il y en a.'];

  sounds constant text[] := array['a', 'i', 'o', 'u', 'é', 'l', 'r', 'm', 's', 'p', 't', 'ou', 'on', 'an', 'ch', 'oi', 'in', 'eu'];
  word_lists constant text[] := array['maison, jardin, école', 'matin, soir, demain', 'chat, chien, cheval',
    'pomme, poire, prune', 'rouge, jaune, vert', 'livre, cahier, crayon', 'pluie, nuage, soleil', 'papa, maman, bébé'];
  poems constant text[] := array['Les feuilles mortes', 'Chanson d''automne', 'Le hérisson', 'La pluie', 'Le bonhomme de neige'];
  books constant text[] := array['Le grand voyage de Petit Loup', 'La maison de la colline', 'Le secret du phare'];
  verbs constant text[] := array['être', 'avoir', 'aller', 'faire', 'jouer', 'chanter', 'finir', 'dire'];
  letter_pairs constant text[] := array['א et ב', 'ג et ד', 'ה et ו', 'ז et ח', 'ט et י', 'כ et ל', 'מ et נ', 'ס et ע', 'פ et צ', 'ק et ר', 'ש et ת'];
  themes_en constant text[] := array['colours', 'numbers', 'animals', 'family', 'weather', 'food'];
  words_en constant text[] := array['red, blue, green', 'one, two, three', 'cat, dog, bird', 'mum, dad, baby', 'sun, rain, wind', 'apple, bread, milk'];
  things_en constant text[] := array['family', 'favourite animal', 'house', 'lunch box'];
  rhymes constant text[] := array['Une poule sur un mur', 'Pomme de reinette', 'Petit escargot', 'Les petits poissons', 'Dans la forêt lointaine'];
  albums constant text[] := array['Le Gruffalo', 'La Moufle', 'Roule galette', 'Petit Ours Brun', 'La Chenille qui fait des trous'];
  songs_he constant text[] := array['Chabbat Chalom', 'Toda', 'Hanouka, Hanouka', 'Boker tov'];
  letters_fr constant text[] := array['B', 'M', 'L', 'P', 'R', 'S', 'T', 'C'];
  -- Les parachiot à partir du Chabbat du 10 octobre 2026 (Béréchit) : la lecture de la semaine.
  parachiot constant text[] := array['Béréchit', 'Noa''h', 'Lekh Lekha', 'Vayéra', '''Hayé Sarah', 'Toledot',
    'Vayétsé', 'Vayichla''h', 'Vayéchev', 'Mikets', 'Vayigach', 'Vay''hi', 'Chemot', 'Vaéra', 'Bo', 'Bechala''h', 'Yitro'];

  journal_kinder constant text[] := array['la rentrée en douceur', 'les pommes', 'les fêtes de Tichri', 'la souccah',
    'les couleurs de l''automne', 'la famille', 'les animaux de la forêt', 'Hanouka', 'l''hiver', 'les cinq sens'];
  journal_elem constant text[] := array['les premiers sons', 'la bibliothèque', 'les fêtes de Tichri', 'le potager',
    'la poésie d''automne', 'les nombres jusqu''à 100', 'l''herbier', 'les planètes', 'Hanouka', 'les métiers'];
  reminders constant text[] := array[
    'le cahier de liaison signé|Merci de signer le cahier de liaison et de le remettre dans le cartable.',
    'vêtements de pluie|La météo s''annonce humide : un vêtement de pluie dans le cartable, s''il vous plaît.',
    'pochette de bibliothèque|La pochette de bibliothèque revient chaque vendredi pour l''échange de livres.',
    'goûter partagé|Vendredi, goûter partagé : un fruit par enfant, déjà lavé.',
    'doudous et draps|Les doudous et les draps rentrent à la maison ce vendredi pour être lavés.'];

  -- Conversations du groupe des parents : chaque ligne « rôle:texte », P/Q/R = trois parents, T = l'enseignante.
  group_talks constant text[][] := array[
    array['P:Bonsoir ! La sortie de jeudi est-elle maintenue avec la pluie annoncée ?', 'T:Bonsoir, oui : prévoyez des bottes et un vêtement de pluie.', 'P:Merci beaucoup !'],
    array['P:Bonjour, mon fils a ramené un gilet gris qui n''est pas à lui. Je le dépose demain à l''accueil.', 'Q:C''est sûrement celui de mon fils, merci !', ''],
    array['P:Quelqu''un aurait-il une photo de la page de lecture du jour ? Le livre est resté en classe.', 'Q:Je vous l''envoie en privé.', 'P:Merci, vous me sauvez la soirée !'],
    array['P:Petit rappel : la collecte de bouchons pour l''association continue jusqu''à vendredi.', 'Q:Super, j''en ai un plein sac à déposer.', 'R:Nous aussi, on l''apporte lundi.'],
    array['P:Nous organisons l''anniversaire de notre fille dimanche après-midi : toute la classe est invitée ! Les cartons sont dans les cartables.', 'Q:Merci pour l''invitation, nous serons là !', 'R:Avec plaisir, à dimanche.'],
    array['P:Quelqu''un fait le trajet depuis Levallois le matin ? Nous aimerions organiser un covoiturage.', 'Q:Oui, nous partons vers 8 h 05. On peut en parler à la sortie.', ''],
    array['T:Merci à toutes et à tous pour vos dons pour le goûter : les enfants se sont régalés !', 'P:Merci à vous pour ce joli moment.', 'Q:Ma fille n''a parlé que de ça hier soir.'],
    array['P:Faut-il un tablier pour l''atelier peinture de mardi ?', 'T:Oui, un vieux tee-shirt suffit aussi.', 'P:Parfait, merci.'],
    array['P:Qui serait disponible pour accompagner la sortie à la bibliothèque ?', 'Q:Moi, je peux le matin.', 'R:Je peux aussi, je m''inscris dans l''agenda.'],
    array['P:Bonjour, la photo de classe est-elle déjà en ligne ?', 'T:Pas encore : le photographe nous l''envoie la semaine prochaine.', ''],
    array['P:Mon fils a oublié son cahier rouge en classe, quelqu''un aurait-il les mots de la dictée ?', 'Q:Les voici : maison, jardin, école, matin, demain.', 'P:Merci mille fois !']];
  official_posts constant text[] := array[
    'Bonne fin de semaine à tous ! Le cahier de vie est à jour : vous y trouverez ce que nous avons fait cette semaine.',
    'Rappel : vendredi, nous fêterons les anniversaires du mois. Les gâteaux sont les bienvenus, sans fruits à coque.',
    'Les cahiers de liaison rentrent ce soir : merci de les signer pour lundi.',
    'Pour la sortie de la semaine prochaine, merci de signer l''autorisation dans l''espace Documents.',
    'Les livres de bibliothèque s''échangent vendredi : pensez à la pochette.',
    'Nous commençons un projet sur les saisons : les objets de la nature sont les bienvenus en classe.'];
  dm_talks constant text[][] := array[
    array['P:Bonjour, {child} a eu de la fièvre cette nuit, il restera à la maison aujourd''hui.', 'T:Bonjour, merci de nous avoir prévenus. Bon rétablissement à {child} !', 'P:Merci beaucoup.'],
    array['P:Bonjour, comment se passe la lecture pour {child} ? Il semble buter sur certains sons.', 'T:Bonjour, il progresse bien ! Nous travaillons les sons « on » et « an » : relisez la page du jour avec lui, cinq minutes suffisent.', 'P:Merci pour ce retour, nous le ferons ce soir.'],
    array['T:Bonjour, {child} a oublié son gilet en classe, je l''ai mis dans son casier.', 'P:Merci beaucoup !', ''],
    array['P:Bonjour, {child} partira à 15 h jeudi pour un rendez-vous médical.', 'T:C''est noté, merci de nous avoir prévenus.', ''],
    array['T:Bonjour, {child} a été formidable aujourd''hui pendant la présentation à la classe. Bravo à lui !', 'P:Quel plaisir de lire ça, merci de nous le dire !', '']];
  director_talks constant text[][] := array[
    array['D:Bonjour, pourriez-vous passer au secrétariat cette semaine pour compléter le dossier d''inscription ?', 'P:Bonjour, bien sûr, je passerai jeudi matin.', 'D:Parfait, merci.'],
    array['P:Bonjour, est-il possible de prendre rendez-vous avec vous au sujet de l''année prochaine ?', 'D:Bonjour, avec plaisir. Mardi à 16 h 45 vous conviendrait-il ?', 'P:C''est parfait, merci.']];
  announcement_lib constant text[] := array[
    'Les nouvelles de l''école|Cette semaine, les classes de maternelle ont visité le potager et les élémentaires ont commencé leur projet sur les saisons. Merci aux familles qui ont accompagné les sorties.',
    'Les nouvelles de l''école|La bibliothèque de l''école s''est enrichie de trente nouveaux albums, offerts par l''association des parents. Les enfants peuvent les emprunter dès lundi.',
    'Les nouvelles de l''école|Les ateliers du midi reprennent : théâtre le lundi, échecs le jeudi. Les inscriptions se font auprès du secrétariat.',
    'Les nouvelles de l''école|Merci à toutes les familles pour la collecte de vêtements chauds : quatre cartons sont partis pour l''association du quartier.'];
  note_lib constant text[] := array[
    'praise|Bravo pour la lecture à voix haute aujourd''hui !',
    'praise|Très belle participation au temps de regroupement.',
    'praise|A beaucoup aidé ses camarades pendant l''atelier.',
    'praise|Belle concentration sur la fiche de calcul.',
    'info|Merci de rapporter le cahier de liaison signé.',
    'info|Les chaussons sont devenus un peu petits : pourriez-vous en prévoir une nouvelle paire ?'];
  menus constant text[][] := array[
    array['Carottes râpées', 'Boulettes de bœuf sauce tomate', 'Semoule', 'Compote de pommes', 'Pain et chocolat'],
    array['Salade de tomates', 'Poisson pané au citron', 'Purée de pommes de terre', 'Fromage blanc au miel', 'Fruit de saison'],
    array['Velouté de potiron', 'Couscous de légumes aux pois chiches', 'Légumes du couscous', 'Clémentines', 'Biscuits'],
    array['Houmous et crudités', 'Saumon au four', 'Riz aux petits légumes', 'Salade de fruits', 'Hallah'],
    array['Salade de concombre', 'Poulet au citron', 'Pommes de terre rôties', 'Poire', 'Pain et confiture'],
    array['Betteraves vinaigrette', 'Omelette aux fines herbes', 'Ratatouille', 'Yaourt nature', 'Fruit de saison'],
    array['Soupe de légumes', 'Lasagnes aux épinards', 'Salade verte', 'Pomme au four', 'Pain et fromage'],
    array['Taboulé', 'Poisson au four sauce tomate', 'Boulgour', 'Compote', 'Hallah']];
begin
  first_day := today - weeks_back * 7;
  last_day := today + weeks_ahead * 7;

  for sch in
    select s.id from public.schools s where s.modules @> '{"test": true}'::jsonb order by s.created_at
  loop
    test_schools := test_schools || sch.id;
    select m.user_id into director from public.memberships m
     where m.school_id = sch.id and m.role = 'school_admin' and m.status = 'active'
     order by m.created_at limit 1;
    select m.user_id into secretary from public.memberships m
     where m.school_id = sch.id and m.role = 'staff' and m.status = 'active'
     order by m.created_at limit 1;

    for cls in
      select c.id, c.name, l.code::text as level_code, l.id as level_id, y.starts_on
      from public.classes c
      join public.levels l on l.id = c.level_id
      join public.school_years y on y.id = c.school_year_id
      where c.school_id = sch.id and not c.archived and y.is_current
      order by l.sort_order, c.name
    loop
      level := cls.level_code;
      elementary := level not in ('TPS', 'PS', 'MS', 'GS');
      select ct.user_id into main_teacher from public.class_teachers ct
       where ct.class_id = cls.id order by (ct.role = 'main') desc, ct.created_at limit 1;
      if main_teacher is null then continue; end if;
      select ct.user_id into english_teacher from public.class_teachers ct
       where ct.class_id = cls.id and ct.subject ilike 'angl%' limit 1;
      select ct.user_id into kodesh_teacher from public.class_teachers ct
       where ct.class_id = cls.id and (ct.subject ilike 'kod%' or ct.subject ilike 'hébr%' or ct.subject ilike 'hebr%') limit 1;

      -- 1. L'emploi du temps, s'il n'y en a pas.
      if not exists (select 1 from public.class_timetable t where t.class_id = cls.id) then
        insert into public.class_timetable (id, school_id, class_id, weekday, starts_at, ends_at, subject, teacher_id, room, created_by)
        select public.demo_id(cls.id::text || ':slot:' || x.weekday || ':' || x.starts_at), sch.id, cls.id, x.weekday,
               x.starts_at::time, x.ends_at::time, x.subject,
               case x.who when 'E' then coalesce(english_teacher, main_teacher)
                          when 'K' then coalesce(kodesh_teacher, main_teacher)
                          else main_teacher end,
               x.room, main_teacher
        from (
          select * from (values
            (1, '08:30', '10:00', 'Français', 'M', null), (1, '10:15', '11:30', 'Mathématiques', 'M', null),
            (1, '13:30', '14:30', 'Hébreu', 'K', null), (1, '14:45', '16:00', 'Questionner le monde', 'M', null),
            (2, '08:30', '10:00', 'Français', 'M', null), (2, '10:15', '11:30', 'Mathématiques', 'M', null),
            (2, '13:30', '14:15', 'Anglais', 'E', 'Salle d''anglais'), (2, '14:30', '16:00', 'Arts plastiques', 'M', null),
            (3, '08:30', '10:00', 'Hébreu', 'K', null), (3, '10:15', '11:30', 'Kodech', 'K', null),
            (4, '08:30', '10:00', 'Français', 'M', null), (4, '10:15', '11:30', 'Mathématiques', 'M', null),
            (4, '13:30', '14:30', 'Hébreu', 'K', null), (4, '14:45', '16:00', 'EPS', 'M', 'Gymnase'),
            (5, '08:30', '10:00', 'Français', 'M', null), (5, '10:15', '11:30', 'Mathématiques', 'M', null),
            (5, '13:30', '14:15', 'Anglais', 'E', 'Salle d''anglais')
          ) as e (weekday, starts_at, ends_at, subject, who, room) where elementary
          union all
          select * from (values
            (1, '08:30', '09:00', 'Accueil et rituels', 'M', null), (1, '09:00', '10:00', 'Langage', 'M', null),
            (1, '10:30', '11:30', 'Motricité', 'M', 'Salle de motricité'), (1, '14:00', '14:45', 'Hébreu', 'K', null),
            (2, '08:30', '09:00', 'Accueil et rituels', 'M', null), (2, '09:00', '10:00', 'Découvrir le monde', 'M', null),
            (2, '10:30', '11:00', 'Anglais', 'E', null), (2, '14:00', '15:00', 'Arts plastiques', 'M', null),
            (4, '08:30', '09:00', 'Accueil et rituels', 'M', null), (4, '09:00', '10:00', 'Langage', 'M', null),
            (4, '10:30', '11:30', 'Motricité', 'M', 'Salle de motricité'), (4, '14:00', '14:45', 'Hébreu', 'K', null),
            (5, '08:30', '09:00', 'Accueil et rituels', 'M', null), (5, '09:00', '10:00', 'Mathématiques', 'M', null),
            (5, '10:30', '11:15', 'Kabbalat Chabbat', 'K', null)
          ) as m (weekday, starts_at, ends_at, subject, who, room) where not elementary
        ) as x
        on conflict (id) do nothing;
        get diagnostics affected = row_count;
        stats := jsonb_set(stats, '{timetable}', to_jsonb((stats ->> 'timetable')::int + affected));
      end if;

      -- 2. Les devoirs, jour de classe par jour de classe.
      -- Le dernier jour de classe déjà terminé (aujourd'hui compte après 16 h 30).
      last_school_day := case when (now() at time zone tz)::time >= time '16:30' then today else today - 1 end;
      while not public.demo_is_school_day(sch.id, last_school_day, elementary) and last_school_day > today - 30 loop
        last_school_day := last_school_day - 1;
      end loop;
      d := first_day;
      while d <= last_day loop
        if public.demo_is_school_day(sch.id, d, elementary) then
          week_idx := greatest(0, (d - date_trunc('week', cls.starts_on)::date) / 7);
          -- La veille de classe, pour la date de publication.
          prev_day := d - 1;
          while not public.demo_is_school_day(sch.id, prev_day, elementary) and prev_day > d - 30 loop
            prev_day := prev_day - 1;
          end loop;
          paracha := case when d >= date '2026-10-04'
                          then parachiot[1 + least(((d + (6 - extract(isodow from d)::int + 7) % 7) - date '2026-10-10') / 7,
                                                   array_length(parachiot, 1) - 1)]
                          else 'de la semaine' end;
          if elementary then
            -- Les matières enseignées ce jour-là, dans l'ordre de la journée.
            select coalesce(array_agg(t.subject order by t.starts_at), '{}') into subjects
            from public.class_timetable t
            where t.class_id = cls.id and t.weekday = extract(isodow from d)::int;
            n := case when extract(isodow from d) = 3 then 1 else 2 + (public.demo_pick(cls.id::text || d, 3) = 0)::int end;
          else
            -- En maternelle : deux choses par semaine, le mardi et le vendredi (ou le jour de classe suivant).
            subjects := '{}';
            n := case when extract(isodow from d) in (2, 5) then 1 else 0 end;
          end if;

          -- Le jour de la rentrée, le travail des vacances (en élémentaire).
          if elementary and prev_day < d - 4 then
            post_id := public.demo_id(cls.id::text || ':holiday-work:' || d);
            published := least((prev_day + time '16:30') at time zone tz, (last_school_day + time '16:30') at time zone tz);
            insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, subject, due_on,
                                            published_at, notified_at, created_at, updated_at)
            values (post_id, sch.id, cls.id, main_teacher, 'homework', 'Pendant les vacances : un livre, un dessin',
                    'Lire un livre de la bibliothèque, puis en dessiner la couverture sur une feuille. Nous les afficherons à la rentrée.',
                    'Français', d, published, now(), published, published)
            on conflict (id) do nothing;
            get diagnostics affected = row_count;
            stats := jsonb_set(stats, '{homework}', to_jsonb((stats ->> 'homework')::int + affected));
          end if;

          for k in 1..n loop
            if elementary then
              exit when coalesce(array_length(subjects, 1), 0) = 0;
              -- La première matière du jour, puis d'autres tirées au sort sans répétition.
              subject := subjects[case when k = 1 then 1
                                        else 1 + public.demo_pick(cls.id::text || d || k, array_length(subjects, 1)) end];
              if subject is null or (k > 1 and subject = subjects[1]) then
                subject := subjects[least(k, array_length(subjects, 1))];
              end if;
              tpl := case
                when subject ilike 'fran%' then (case when level = 'CP' then lib_fr_cp else lib_fr_ce end)
                         [1 + public.demo_pick('fr' || cls.id || d || k, 6)]
                when subject ilike 'math%' then (case when level = 'CP' then lib_math_cp else lib_math_ce end)
                         [1 + public.demo_pick('ma' || cls.id || d || k, 5)]
                when subject ilike 'hébr%' then lib_hebrew[1 + public.demo_pick('he' || cls.id || d || k, 4)]
                when subject ilike 'kod%' then lib_kodesh[1 + public.demo_pick('ko' || cls.id || d || k, 3)]
                when subject ilike 'angl%' then lib_english[1 + public.demo_pick('en' || cls.id || d || k, 3)]
                when subject ilike 'quest%' then lib_world[1 + public.demo_pick('qm' || cls.id || d || k, 4)]
                when subject ilike 'arts%' then lib_arts[1 + public.demo_pick('ar' || cls.id || d || k, 2)]
                when subject ilike 'eps%' then lib_sport[1]
                else null end;
              continue when tpl is null;
            else
              tpl := (case when level = 'GS' and public.demo_pick('gs' || cls.id || d, 2) = 0
                           then lib_kinder_gs[1 + public.demo_pick('kg' || cls.id || d, 3)]
                           else lib_kinder[1 + public.demo_pick('ki' || cls.id || d, 7)] end);
              subject := split_part(tpl, '|', 1);
              tpl := substr(tpl, length(subject) + 2);
            end if;

            title := split_part(tpl, '|', 1);
            body := split_part(tpl, '|', 2);
            -- Ce qui progresse avec l'année : les pages, les sons, les tables, les lettres.
            title := replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(title,
              '{page}', (6 + week_idx * 4 + extract(isodow from d)::int)::text),
              '{n}', (1 + week_idx)::text),
              '{sound}', sounds[1 + week_idx % array_length(sounds, 1)]),
              '{words}', word_lists[1 + (week_idx + extract(isodow from d)::int) % array_length(word_lists, 1)]),
              '{poem}', poems[1 + (week_idx / 2) % array_length(poems, 1)]),
              '{book}', books[1 + (week_idx / 4) % array_length(books, 1)]),
              '{verb}', verbs[1 + week_idx % array_length(verbs, 1)]),
              '{step}', (2 + week_idx % 4)::text),
              '{limit}', (20 + 10 * least(week_idx, 8))::text),
              '{table}', (2 + week_idx % 5)::text),
              '{letters}', letter_pairs[1 + week_idx % array_length(letter_pairs, 1)]),
              '{paracha}', paracha),
              '{theme}', themes_en[1 + week_idx % array_length(themes_en, 1)]),
              '{words_en}', words_en[1 + week_idx % array_length(words_en, 1)]),
              '{thing}', things_en[1 + week_idx % array_length(things_en, 1)]),
              '{rhyme}', rhymes[1 + (week_idx / 2) % array_length(rhymes, 1)]),
              '{album}', albums[1 + week_idx % array_length(albums, 1)]),
              '{song_he}', songs_he[1 + week_idx % array_length(songs_he, 1)]),
              '{letter}', letters_fr[1 + week_idx % array_length(letters_fr, 1)]);
            body := replace(replace(replace(body, '{words}', word_lists[1 + (week_idx + extract(isodow from d)::int) % array_length(word_lists, 1)]),
              '{paracha}', paracha), '{rhyme}', rhymes[1 + (week_idx / 2) % array_length(rhymes, 1)]);

            author := case when subject ilike 'angl%' then coalesce(english_teacher, main_teacher)
                           when subject ilike 'hébr%' or subject ilike 'kod%' then coalesce(kodesh_teacher, main_teacher)
                           else main_teacher end;
            -- Publié la veille de classe en fin d'après-midi. Ce qui tombe dans les jours qui viennent l'a
            -- été au dernier jour de classe écoulé ; ce qui tombe au-delà d'une semaine appartient au
            -- programme de la période, saisi à son début — sinon le fil « Dans vos classes » de
            -- l'enseignante n'aurait montré que soixante devoirs publiés le jour même.
            published := case
              when d > today + 7 then ((first_day + public.demo_pick('plan' || cls.id, 3) + time '17:00') at time zone tz)
                                      + make_interval(mins => public.demo_pick('pln' || cls.id || d || k, 90))
              else least(((prev_day + time '16:30') at time zone tz),
                         ((last_school_day + time '16:30') at time zone tz))
                   + make_interval(mins => public.demo_pick('pub' || cls.id || d || k, 75)) end;
            post_id := public.demo_id(cls.id::text || ':homework:' || d || ':' || k);
            insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, subject, due_on,
                                            published_at, notified_at, created_at, updated_at)
            values (post_id, sch.id, cls.id, author, 'homework', left(title, 200), body, subject, d,
                    published, now(), published, published)
            on conflict (id) do nothing;
            get diagnostics affected = row_count;
            stats := jsonb_set(stats, '{homework}', to_jsonb((stats ->> 'homework')::int + affected));

            -- « Fait », pour les trois quarts des élèves, la veille au soir.
            if affected > 0 and d < today then
              insert into public.homework_completions (post_id, student_id, marked_by_user_id, done_at)
              select post_id, e.student_id,
                     (select sg.user_id from public.student_guardians sg
                       where sg.student_id = e.student_id and not sg.access_blocked
                       order by sg.is_primary desc, sg.created_at limit 1),
                     ((d - 1) + time '19:00') at time zone tz + make_interval(mins => public.demo_pick(post_id::text || e.student_id, 150))
              from public.enrollments e
              where e.class_id = cls.id and (e.left_on is null or e.left_on >= today)
                and public.demo_pick(post_id::text || ':done:' || e.student_id, 100) < 78
              on conflict do nothing;
              get diagnostics affected = row_count;
              stats := jsonb_set(stats, '{completions}', to_jsonb((stats ->> 'completions')::int + affected));
            end if;
          end loop;
        end if;
        d := d + 1;
      end loop;

      -- 3. Le cahier de vie : un billet par semaine de classe écoulée, un rappel une semaine sur deux.
      monday := date_trunc('week', first_day)::date;
      while monday <= today loop
        -- le dernier jour de classe de la semaine, s'il est passé
        d := monday + 4;
        while d >= monday and not public.demo_is_school_day(sch.id, d, elementary) loop d := d - 1; end loop;
        if d >= monday and d <= today then
          week_idx := greatest(0, (monday - date_trunc('week', cls.starts_on)::date) / 7);
          -- la paracha du Chabbat de cette semaine-là
          paracha := case when monday + 5 >= date '2026-10-10'
                          then parachiot[1 + least((monday + 5 - date '2026-10-10') / 7, array_length(parachiot, 1) - 1)]
                          else 'de la semaine' end;
          published := ((d + time '15:40') at time zone tz) + make_interval(mins => public.demo_pick('jr' || cls.id || monday, 50));
          if published < now() then
            title := 'Notre semaine : ' || (case when elementary then journal_elem else journal_kinder end)
                       [1 + week_idx % 10];
            body := case when elementary then
                'Cette semaine, nous avons travaillé sur ' || (case when elementary then journal_elem else journal_kinder end)[1 + week_idx % 10]
                || '.' || E'\n\n' || '- En lecture, le son « ' || sounds[1 + week_idx % array_length(sounds, 1)] || ' » ;'
                || E'\n' || '- en mathématiques, les nombres jusqu''à ' || (20 + 10 * least(week_idx, 8)) || ' ;'
                || E'\n' || '- en Kodech, la paracha ' || paracha || '.'
                || E'\n\n' || 'Merci aux familles qui ont accompagné la classe.'
              else
                'Cette semaine, les enfants ont découvert ' || journal_kinder[1 + week_idx % 10] || '.'
                || E'\n\n' || '- Une nouvelle comptine : « ' || rhymes[1 + (week_idx / 2) % array_length(rhymes, 1)] || ' » ;'
                || E'\n' || '- un album lu ensemble : « ' || albums[1 + week_idx % array_length(albums, 1)] || ' » ;'
                || E'\n' || '- des jeux de motricité dans la grande salle.'
                || E'\n\n' || 'Demandez-leur de vous chanter la comptine !'
              end;
            insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, published_at, notified_at, created_at, updated_at)
            values (public.demo_id(cls.id::text || ':journal:' || monday), sch.id, cls.id, main_teacher, 'journal',
                    title, body, published, now(), published, published)
            on conflict (id) do nothing;
            get diagnostics affected = row_count;
            stats := jsonb_set(stats, '{journal}', to_jsonb((stats ->> 'journal')::int + affected));
            if week_idx % 2 = 1 then
              tpl := reminders[1 + (week_idx / 2) % array_length(reminders, 1)];
              insert into public.class_posts (id, school_id, class_id, author_id, type, title, body_md, published_at, notified_at, created_at, updated_at)
              values (public.demo_id(cls.id::text || ':reminder:' || monday), sch.id, cls.id, main_teacher, 'reminder',
                      'Rappel : ' || split_part(tpl, '|', 1), split_part(tpl, '|', 2),
                      published - interval '2 days', now(), published - interval '2 days', published - interval '2 days')
              on conflict (id) do nothing;
            end if;
          end if;
        end if;
        monday := monday + 7;
      end loop;

      -- 4. Les fils de la classe : le canal officiel et le groupe des parents, s'ils manquent.
      select t.id into official from public.threads t where t.class_id = cls.id and t.kind = 'class_official' order by t.created_at limit 1;
      if official is null then
        official := public.demo_id(cls.id::text || ':official');
        insert into public.threads (id, school_id, kind, class_id, title, created_by, allow_replies)
        values (official, sch.id, 'class_official', cls.id, 'Informations de la classe', main_teacher, false)
        on conflict (id) do nothing;
      end if;
      select t.id into grp from public.threads t where t.class_id = cls.id and t.kind = 'class_group' order by t.created_at limit 1;
      if grp is null then
        grp := public.demo_id(cls.id::text || ':group');
        insert into public.threads (id, school_id, kind, class_id, title, created_by, allow_replies)
        values (grp, sch.id, 'class_group', cls.id, 'Parents de la classe', main_teacher, true)
        on conflict (id) do nothing;
      end if;
      insert into public.thread_members (thread_id, user_id, role)
      select t.id, ct.user_id, 'moderator'::public.thread_member_role
      from public.class_teachers ct cross join (values (official), (grp)) as t (id)
      where ct.class_id = cls.id
      on conflict do nothing;
      insert into public.thread_members (thread_id, user_id, role)
      select distinct t.id, sg.user_id, 'member'::public.thread_member_role
      from public.enrollments e
      join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
      join public.memberships m on m.user_id = sg.user_id and m.school_id = sch.id and m.status = 'active' and m.role = 'parent'
      cross join (values (official), (grp)) as t (id)
      where e.class_id = cls.id and (e.left_on is null or e.left_on >= today)
      on conflict do nothing;

      -- Les parents actifs de la classe, dans un ordre stable.
      -- Les comptes de la porte « Espace de test » d'abord : c'est par eux qu'on regarde.
      select coalesce(array_agg(x.user_id order by (u.email like 'parent-1@%') desc, md5(x.user_id::text || cls.id)), '{}')
        into parents
      from (select distinct sg.user_id
            from public.enrollments e
            join public.student_guardians sg on sg.student_id = e.student_id and not sg.access_blocked
            join public.memberships m on m.user_id = sg.user_id and m.school_id = sch.id and m.status = 'active' and m.role = 'parent'
            where e.class_id = cls.id and (e.left_on is null or e.left_on >= today)) x
      join auth.users u on u.id = x.user_id;

      if coalesce(array_length(parents, 1), 0) >= 3 then
        -- Le groupe des parents : une conversation un jour sur deux environ, le soir ou le matin, jamais pendant Chabbat.
        d := first_day;
        while d <= today loop
          if public.demo_pick('talk' || cls.id || d, 5) < 2 and extract(isodow from d) <> 6 then
            k := 1 + public.demo_pick('which' || cls.id || d, array_length(group_talks, 1));
            parent_a := parents[1 + public.demo_pick('pa' || cls.id || d, array_length(parents, 1))];
            parent_b := parents[1 + (public.demo_pick('pa' || cls.id || d, array_length(parents, 1)) + 1) % array_length(parents, 1)];
            parent_c := parents[1 + (public.demo_pick('pa' || cls.id || d, array_length(parents, 1)) + 2) % array_length(parents, 1)];
            at_ts := (d + case when extract(isodow from d) = 5 then time '08:10' else time '19:20' end) at time zone tz
                     + make_interval(mins => public.demo_pick('t0' || cls.id || d, 80));
            for i in 1..array_length(group_talks, 2) loop
              line := group_talks[k][i];
              continue when line is null or line = '';
              who := split_part(line, ':', 1);
              speaker := case who when 'P' then parent_a when 'Q' then parent_b when 'R' then parent_c else main_teacher end;
              exit when at_ts > now();
              insert into public.messages (id, thread_id, author_id, body, created_at)
              values (public.demo_id(grp::text || ':' || d || ':' || i), grp, speaker, substr(line, 3), at_ts)
              on conflict (id) do nothing;
              get diagnostics affected = row_count;
              stats := jsonb_set(stats, '{messages}', to_jsonb((stats ->> 'messages')::int + affected));
              at_ts := at_ts + make_interval(mins => 6 + public.demo_pick('gap' || grp || d || i, 40));
            end loop;
          end if;
          -- Le canal officiel : un message le vendredi après la classe, une semaine sur deux un mardi aussi.
          if (extract(isodow from d) = 5 or (extract(isodow from d) = 2 and public.demo_pick('off' || cls.id || d, 2) = 0))
             and public.demo_is_school_day(sch.id, d, elementary) then
            at_ts := ((d + time '16:50') at time zone tz) + make_interval(mins => public.demo_pick('o0' || cls.id || d, 40));
            if at_ts <= now() then
              insert into public.messages (id, thread_id, author_id, body, created_at)
              values (public.demo_id(official::text || ':' || d), official, main_teacher,
                      official_posts[1 + public.demo_pick('op' || cls.id || d, array_length(official_posts, 1))], at_ts)
              on conflict (id) do nothing;
              get diagnostics affected = row_count;
              stats := jsonb_set(stats, '{messages}', to_jsonb((stats ->> 'messages')::int + affected));
            end if;
          end if;
          d := d + 1;
        end loop;

        -- Des messages directs entre l'enseignante principale et trois familles.
        for i in 1..3 loop
          parent_a := parents[i];
          select s.first_name into child_name
          from public.student_guardians sg
          join public.students s on s.id = sg.student_id
          join public.enrollments e on e.student_id = s.id and e.class_id = cls.id and (e.left_on is null or e.left_on >= today)
          where sg.user_id = parent_a order by s.first_name limit 1;
          select t.id into dm from public.threads t
          where t.kind = 'dm' and t.school_id = sch.id
            and exists (select 1 from public.thread_members a where a.thread_id = t.id and a.user_id = parent_a)
            and exists (select 1 from public.thread_members b where b.thread_id = t.id and b.user_id = main_teacher)
            and (select count(*) from public.thread_members c where c.thread_id = t.id) = 2
          order by t.created_at limit 1;
          if dm is null then
            dm := public.demo_id(cls.id::text || ':dm:' || parent_a);
            insert into public.threads (id, school_id, kind, created_by) values (dm, sch.id, 'dm', parent_a)
            on conflict (id) do nothing;
            insert into public.thread_members (thread_id, user_id, role)
            values (dm, parent_a, 'member'), (dm, main_teacher, 'member')
            on conflict do nothing;
            get diagnostics affected = row_count;
            stats := jsonb_set(stats, '{threads}', to_jsonb((stats ->> 'threads')::int + case when affected > 0 then 1 else 0 end));
          end if;
          -- Une conversation toutes les deux semaines environ.
          d := first_day + public.demo_pick('dmd' || dm, 10);
          while d <= today loop
            if extract(isodow from d) not in (6, 7) then
              k := 1 + public.demo_pick('dmk' || dm || d, array_length(dm_talks, 1));
              at_ts := ((d + time '07:45') at time zone tz) + make_interval(mins => public.demo_pick('dmt' || dm || d, 600));
              for n in 1..array_length(dm_talks, 2) loop
                line := dm_talks[k][n];
                continue when line is null or line = '';
                exit when at_ts > now();
                speaker := case split_part(line, ':', 1) when 'T' then main_teacher else parent_a end;
                insert into public.messages (id, thread_id, author_id, body, created_at)
                values (public.demo_id(dm::text || ':' || d || ':' || n), dm, speaker,
                        replace(substr(line, 3), '{child}', coalesce(child_name, 'votre enfant')), at_ts)
                on conflict (id) do nothing;
                get diagnostics affected = row_count;
                stats := jsonb_set(stats, '{messages}', to_jsonb((stats ->> 'messages')::int + affected));
                at_ts := at_ts + make_interval(mins => 15 + public.demo_pick('dmg' || dm || d || n, 180));
              end loop;
            end if;
            d := d + 11 + public.demo_pick('dmn' || dm || d, 7);
          end loop;
        end loop;

        -- Des mots aux familles, un toutes les deux semaines environ.
        d := first_day;
        while d <= today loop
          if public.demo_is_school_day(sch.id, d, elementary) and public.demo_pick('note' || cls.id || d, 6) = 0 then
            tpl := note_lib[1 + public.demo_pick('nl' || cls.id || d, array_length(note_lib, 1))];
            insert into public.individual_notes (id, school_id, student_id, author_id, body_md, visibility, kind, created_at, updated_at)
            select public.demo_id(cls.id::text || ':note:' || d), sch.id, e.student_id, main_teacher,
                   split_part(tpl, '|', 2), 'parents', split_part(tpl, '|', 1)::public.note_kind,
                   ((d + time '16:40') at time zone tz), ((d + time '16:40') at time zone tz)
            from public.enrollments e
            where e.class_id = cls.id and (e.left_on is null or e.left_on >= today)
            order by md5(e.student_id::text || d) limit 1
            on conflict (id) do nothing;
            get diagnostics affected = row_count;
            stats := jsonb_set(stats, '{notes}', to_jsonb((stats ->> 'notes')::int + affected));
          end if;
          d := d + 1;
        end loop;
      end if;
    end loop; -- classes

    -- 5. La direction : deux conversations avec des familles.
    if director is not null then
      for i in 1..2 loop
        select m.user_id into parent_a from public.memberships m join auth.users u on u.id = m.user_id
        where m.school_id = sch.id and m.role = 'parent' and m.status = 'active'
        order by (i = 1 and u.email like 'parent-1@%') desc, md5(m.user_id::text || ':director:' || i) limit 1;
        continue when parent_a is null;
        select t.id into dm from public.threads t
        where t.kind = 'dm' and t.school_id = sch.id
          and exists (select 1 from public.thread_members a where a.thread_id = t.id and a.user_id = parent_a)
          and exists (select 1 from public.thread_members b where b.thread_id = t.id and b.user_id = director)
          and (select count(*) from public.thread_members c where c.thread_id = t.id) = 2
        order by t.created_at limit 1;
        if dm is null then
          dm := public.demo_id(sch.id::text || ':director-dm:' || parent_a);
          insert into public.threads (id, school_id, kind, created_by) values (dm, sch.id, 'dm', director)
          on conflict (id) do nothing;
          insert into public.thread_members (thread_id, user_id, role)
          values (dm, parent_a, 'member'), (dm, director, 'member')
          on conflict do nothing;
        end if;
        d := today - 3 - i * 4;
        at_ts := ((d + time '09:10') at time zone tz);
        for n in 1..array_length(director_talks, 2) loop
          line := director_talks[i][n];
          continue when line is null or line = '';
          speaker := case split_part(line, ':', 1) when 'D' then director else parent_a end;
          insert into public.messages (id, thread_id, author_id, body, created_at)
          values (public.demo_id(dm::text || ':director:' || n), dm, speaker, substr(line, 3), at_ts)
          on conflict (id) do nothing;
          get diagnostics affected = row_count;
          stats := jsonb_set(stats, '{messages}', to_jsonb((stats ->> 'messages')::int + affected));
          at_ts := at_ts + make_interval(mins => 40 + 90 * n);
        end loop;
      end loop;

      -- 6. Les nouvelles de l'école, un vendredi sur deux.
      d := first_day;
      while d <= today loop
        if extract(isodow from d) = 5 and public.demo_pick('ann' || sch.id || d, 2) = 0
           and ((d + time '17:30') at time zone tz) <= now() then
          tpl := announcement_lib[1 + public.demo_pick('al' || sch.id || d, array_length(announcement_lib, 1))];
          insert into public.announcements (id, school_id, author_id, audience, target_ids, title, body_md,
                                             published_at, notified_at, created_at, updated_at)
          values (public.demo_id(sch.id::text || ':news:' || d), sch.id, director, 'school', '{}',
                  split_part(tpl, '|', 1) || ' — ' || to_char(d, 'DD/MM'), split_part(tpl, '|', 2),
                  (d + time '17:30') at time zone tz, now(),
                  (d + time '17:30') at time zone tz, (d + time '17:30') at time zone tz)
          on conflict (id) do nothing;
          get diagnostics affected = row_count;
          stats := jsonb_set(stats, '{announcements}', to_jsonb((stats ->> 'announcements')::int + affected));
        end if;
        d := d + 1;
      end loop;
    end if;

    -- 7. Les événements du trimestre (dates de l'année 2026-2027), sans doublon.
    insert into public.events (id, school_id, scope, target_ids, title, description_md, starts_at, ends_at, all_day,
                               location, kind, requires_rsvp, capacity, rsvp_deadline, created_by)
    select public.demo_id(sch.id::text || ':event:' || e.key), sch.id, e.scope::public.event_scope,
           case when e.scope = 'school' then '{}'::uuid[]
                else coalesce((select array_agg(c.id) from public.classes c join public.levels l on l.id = c.level_id
                                join public.school_years y on y.id = c.school_year_id
                               where c.school_id = sch.id and l.code::text = e.level and y.is_current and not c.archived), '{}') end,
           e.title, e.description, e.starts_at::timestamptz, e.ends_at::timestamptz, false, e.location,
           e.kind::public.event_kind, e.rsvp, e.capacity, e.deadline::timestamptz, director
    from (values
      ('parents-meeting', 'school', null, 'Réunion parents-enseignants', 'Chaque enseignante reçoit les familles de 16 h 45 à 19 h. Les créneaux se réservent dans l''espace de la classe, onglet Rendez-vous.', '2026-11-12 16:45+01', '2026-11-12 19:00+01', 'Dans les classes', 'meeting', false, null::int, null),
      ('cp-shabbat', 'class', 'CP', 'Kabbalat Chabbat des CP', 'Les familles sont invitées à partager le kabbalat Chabbat de la classe.', '2026-11-20 15:00+01', '2026-11-20 16:00+01', 'Salle des CP', 'celebration', true, 30, '2026-11-18 18:00+01'),
      ('ms-farm', 'class', 'MS', 'Sortie à la ferme pédagogique', 'Départ en car à 9 h, retour vers 15 h. Prévoir un pique-nique et des bottes.', '2026-11-26 09:00+01', '2026-11-26 15:00+01', 'Ferme pédagogique', 'outing', true, null, '2026-11-20 18:00+01'),
      ('gs-donuts', 'class', 'GS', 'Atelier beignets de Hanouka', 'Les enfants préparent les beignets avec deux parents volontaires.', '2026-12-10 14:00+01', '2026-12-10 15:30+01', 'Cuisine pédagogique', 'celebration', false, null, null),
      ('show', 'school', null, 'Spectacle de fin de trimestre', 'Chants et saynètes de toutes les classes, suivis d''un goûter.', '2026-12-17 18:00+01', '2026-12-17 19:30+01', 'Salle polyvalente', 'celebration', true, 200, '2026-12-14 18:00+01')
    ) as e (key, scope, level, title, description, starts_at, ends_at, location, kind, rsvp, capacity, deadline)
    where e.starts_at::timestamptz > now() - interval '30 days'
    on conflict (id) do nothing;
    get diagnostics affected = row_count;
    stats := jsonb_set(stats, '{events}', to_jsonb((stats ->> 'events')::int + affected));
    insert into public.event_slots (id, event_id, label, needed, sort_order)
    select public.demo_id(sch.id::text || ':slot:' || s.label), public.demo_id(sch.id::text || ':event:' || s.key), s.label, s.needed, s.sort_order
    from (values ('show', 'Installer la salle', 4, 1), ('show', 'Tenir le stand de gâteaux', 3, 2),
                 ('ms-farm', 'Accompagner la sortie', 4, 1), ('gs-donuts', 'Aider à l''atelier', 2, 1)) as s (key, label, needed, sort_order)
    where exists (select 1 from public.events ev where ev.id = public.demo_id(sch.id::text || ':event:' || s.key))
    on conflict (id) do nothing;

    -- 8. Les menus des semaines à venir (hors vacances), quatre jours, le mercredi sans cantine.
    monday := date_trunc('week', today)::date - 7;
    while monday <= date_trunc('week', last_day)::date loop
      if exists (select 1 from generate_series(0, 4) g where public.demo_is_school_day(sch.id, monday + g, false))
         and not exists (select 1 from public.weekly_menus w where w.school_id = sch.id and w.week_start = monday) then
        menu := public.demo_id(sch.id::text || ':menu:' || monday);
        insert into public.weekly_menus (id, school_id, week_start, published_at, created_by, created_at, updated_at)
        values (menu, sch.id, monday, least((monday - 3 + time '16:00') at time zone tz, now()), coalesce(secretary, director),
                least((monday - 3 + time '16:00') at time zone tz, now()), least((monday - 3 + time '16:00') at time zone tz, now()))
        on conflict do nothing;
        get diagnostics affected = row_count;
        if affected > 0 then
          stats := jsonb_set(stats, '{menus}', to_jsonb((stats ->> 'menus')::int + 1));
          insert into public.weekly_menu_days (id, menu_id, day, starter, main_course, side, dessert, snack, note)
          select public.demo_id(menu::text || ':' || g), menu, g,
                 menus[1 + (k2 % array_length(menus, 1))][1], menus[1 + (k2 % array_length(menus, 1))][2],
                 menus[1 + (k2 % array_length(menus, 1))][3], menus[1 + (k2 % array_length(menus, 1))][4],
                 case when g = 5 then 'Hallah' else menus[1 + (k2 % array_length(menus, 1))][5] end,
                 case when g = 5 then 'Goûter de Chabbat' else null end
          from (select g, ((monday - date '2026-08-31') / 7) * 4 + g as k2
                from unnest(array[1, 2, 4, 5]) as g
                where public.demo_is_school_day(sch.id, monday + g - 1, false)) days
          on conflict do nothing;
        end if;
      end if;
      monday := monday + 7;
    end loop;
  end loop; -- schools

  if coalesce(array_length(test_schools, 1), 0) = 0 then
    return stats || jsonb_build_object('schools', 0);
  end if;

  -- Les fils : leur dernier message, et ce qui est lu (tout, sauf les deux derniers jours).
  update public.threads t
     set last_message_at = x.last_at
    from (select m.thread_id, max(m.created_at) as last_at
            from public.messages m join public.threads tt on tt.id = m.thread_id
           where tt.school_id = any (test_schools) and m.deleted_at is null
           group by m.thread_id) x
   where t.id = x.thread_id and t.last_message_at is distinct from x.last_at;
  update public.thread_members tm
     set last_read_at = now() - interval '2 days'
    from public.threads t
   where t.id = tm.thread_id and t.school_id = any (test_schools)
     and (tm.last_read_at is null or tm.last_read_at < now() - interval '2 days');

  -- Personne n'est prévenu : les notifications de cet appel disparaissent, sauf celles des deux
  -- derniers jours, laissées non lues ; aucune ne part par e-mail ou par push.
  delete from public.notifications n
   where n.school_id = any (test_schools) and n.created_at = now()
     and not (n.kind = 'message.new' and exists (
           select 1 from public.messages m
            where m.id = (n.payload ->> 'message_id')::uuid and m.created_at > now() - interval '2 days'));
  update public.notification_deliveries dl
     set sent_at = now(), last_error = 'test school'
    from public.notifications n
   where n.id = dl.notification_id and n.school_id = any (test_schools) and n.created_at = now()
     and dl.sent_at is null;

  return stats || jsonb_build_object('schools', array_length(test_schools, 1), 'from', first_day, 'to', last_day);
end
$$;

comment on function public.refresh_test_school_content(integer, integer) is
  'Fills the test school(s) (modules.test) with fictional, date-relative content: timetables, homework, class-life posts, conversations, announcements, events, menus, notes. Idempotent; never touches another school; notifies nobody (ADR-0077).';
revoke all on function public.refresh_test_school_content(integer, integer) from public, anon, authenticated;
grant execute on function public.refresh_test_school_content(integer, integer) to service_role;

-- Une première fois maintenant : en production, l'école test existe déjà. En local, les
-- migrations passent avant le seed, il n'y a pas encore d'école test et l'appel ne fait rien.
select public.refresh_test_school_content();
