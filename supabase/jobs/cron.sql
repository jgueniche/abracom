-- Kesher — planification des jobs de notification avec pg_cron + pg_net (projet Supabase cloud).
-- À exécuter UNE FOIS dans l'éditeur SQL du projet, après avoir remplacé les deux secrets.
-- Vercel Cron (vercel.json) couvre déjà le digest et les rappels quotidiens ; ce script ajoute
-- l'envoi des push / e-mails toutes les cinq minutes, qu'un plan Hobby Vercel ne permet pas.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 1. Secrets dans Vault (jamais dans une migration) : URL publique du site et CRON_SECRET (Vercel).
select vault.create_secret('https://abracom.vercel.app', 'kesher_site_url', 'URL publique de Kesher');
select vault.create_secret('remplacer-par-le-CRON_SECRET-de-vercel', 'kesher_cron_secret', 'Secret des jobs Kesher');

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

-- 3. Digest quotidien à 18 h heure de Paris : pg_cron évalue les horaires en UTC, d'où deux
--    déclenchements (16 h UTC = 18 h en été, 17 h UTC = 18 h en hiver) ; le second ne renvoie que
--    les nouveautés arrivées entre-temps (les notifications déjà résumées sont marquées).
select cron.schedule(
  'kesher-notifications-digest',
  '0 16,17 * * *',
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

-- 4. Rappels J-7 / J-1 des événements, tous les matins (7 h 30 en été, 6 h 30 en hiver).
select cron.schedule(
  'kesher-event-reminders',
  '30 5 * * *',
  $$ select public.queue_event_reminders(); $$
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
