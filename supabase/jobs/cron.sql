-- Kesher — planification des jobs de notification avec pg_cron + pg_net (projet Supabase cloud).
-- À exécuter UNE FOIS dans l'éditeur SQL du projet, après avoir créé les deux secrets dans Vault
-- (tableau de bord → Vault, ou psql ; jamais en clair dans l'éditeur SQL, dont l'historique est
-- conservé). pg_cron est le SEUL planificateur : aucun cron Vercel ne double ces appels.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 1. Secrets attendus dans Vault : `kesher_site_url` (URL publique) et `kesher_cron_secret`
--    (identique à CRON_SECRET sur Vercel, 16 caractères minimum). Exemple via psql :
--      \set site 'https://abracom.vercel.app'
--      \set secret 'valeur-lue-depuis-un-gestionnaire-de-mots-de-passe'
--      select vault.create_secret(:'site', 'kesher_site_url', 'URL publique de Kesher');
--      select vault.create_secret(:'secret', 'kesher_cron_secret', 'Secret des jobs Kesher');

-- 2. Envoi des notifications en attente (push + e-mail), toutes les cinq minutes.
select cron.schedule(
  'kesher-notifications-dispatch',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'kesher_site_url') || '/api/jobs/notifications?task=dispatch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'kesher_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- 3. Digest du soir : appelé chaque heure entre 15 h et 20 h UTC ; le worker n'envoie qu'entre
--    17 h et 21 h heure de l'école, hors Chabbat / fêtes / heures calmes, et au plus une fois par
--    20 heures et par personne (un vendredi d'hiver, le digest part donc le samedi soir).
select cron.schedule(
  'kesher-notifications-digest',
  '0 15-20 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'kesher_site_url') || '/api/jobs/notifications?task=digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'kesher_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- 4. Rappels J-7 / J-1 des événements et J-3 des anniversaires, tous les matins (7 h 30 en été,
--    6 h 30 en hiver ; les envois avant 7 h sont reportés par les heures calmes).
select cron.schedule(
  'kesher-event-reminders',
  '30 5 * * *',
  $$ select public.queue_event_reminders(); select public.queue_birthday_reminders(); $$
);

-- 5. Purge de rétention (docs/RGPD.md), chaque nuit à 3 h UTC.
select cron.schedule(
  'kesher-retention-purge',
  '0 3 * * *',
  $$ select public.purge_expired_data(); $$
);

-- Vérification / suppression :
--   select jobid, jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('kesher-notifications-dispatch');
