# Jobs de notification

Le worker est la route `POST|GET /api/jobs/notifications?task=dispatch|digest|reminders`
(`server/jobs/notifications.ts`), protégée par le bearer `CRON_SECRET`.

| Tâche       | Rôle                                                                                                                                              | Fréquence conseillée  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `dispatch`  | fan-out du contenu publié, envoi des push (VAPID) et e-mails (Resend) dus, report des envois tombant pendant Chabbat / fêtes ou les heures calmes | toutes les 5 min      |
| `digest`    | un e-mail par personne avec les notifications non lues de la journée (hors messages déjà e-mailés)                                                | 18 h heure de l'école |
| `reminders` | rappels J-7 / J-1 des événements (`queue_event_reminders()`)                                                                                      | tous les matins       |

## Déclenchement

- **Vercel Cron** (`vercel.json`) : `digest` et `reminders` une fois par jour. Sur un plan Hobby,
  Vercel n'autorise que des tâches quotidiennes ; Vercel ajoute lui-même l'en-tête
  `Authorization: Bearer $CRON_SECRET`.
- **Supabase pg_cron + pg_net** (`cron.sql`) : `dispatch` toutes les cinq minutes (et, en option,
  le digest et les rappels si l'on préfère tout piloter depuis la base). Les secrets vivent dans
  Vault, jamais dans une migration.
- **À la main** : `curl -H "Authorization: Bearer $CRON_SECRET" "$SITE/api/jobs/notifications?task=dispatch"`.

## Variables d'environnement (Vercel)

`CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` (voir `.env.example`). Sans elles, le worker répond 503 (`CRON_SECRET`) ou laisse
les envois en attente sans consommer de tentatives (`last_error = push_not_configured` /
`email_not_configured`).

## Mode Chabbat / fêtes

La fenêtre (une heure avant l'allumage des bougies → une heure après la havdalah, yamim tovim
compris) est calculée par `lib/hebcal` avec les coordonnées de l'école ; les heures calmes viennent
des préférences de chaque personne. `lib/notifications/schedule.ts` est couvert par
`tests/unit/notification-schedule.test.ts` (Chabbat simulé).
