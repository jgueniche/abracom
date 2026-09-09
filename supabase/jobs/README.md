# Jobs de notification

Le worker est la route `POST|GET /api/jobs/notifications?task=dispatch|digest|reminders`
(`server/jobs/notifications.ts`), protégée par le bearer `CRON_SECRET`.

| Tâche       | Rôle                                                                                                                                                 | Fréquence conseillée      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `dispatch`  | fan-out du contenu publié, envoi des push (VAPID) et e-mails (Resend) dus, report des envois tombant pendant Chabbat / fêtes ou les heures calmes    | toutes les 5 min          |
| `digest`    | un e-mail par personne avec les notifications non lues (hors messages déjà e-mailés), au plus une fois par 20 h, entre 17 h et 21 h heure de l'école | chaque heure, 15–20 h UTC |
| `reminders` | rappels J-7 / J-1 des événements, J-3 des anniversaires, purge de rétention                                                                          | tous les matins           |

## Déclenchement

- **Supabase pg_cron + pg_net** (`cron.sql`) est le seul planificateur : `dispatch` toutes les cinq
  minutes, `digest` chaque heure du soir, rappels et purge chaque matin. Les secrets vivent dans
  Vault, jamais dans une migration ni dans l'éditeur SQL. Un plan Hobby Vercel n'autorise que des
  crons quotidiens, et deux planificateurs enverraient des doublons : `vercel.json` n'en déclare
  aucun.
- **À la main** : `curl -H "Authorization: Bearer $CRON_SECRET" "$SITE/api/jobs/notifications?task=dispatch"`.
  Une livraison réclamée est verrouillée deux minutes ; les échecs sont rejoués avec un repli
  exponentiel (5, 10, 20, 40 min) puis abandonnés et journalisés après cinq tentatives ; un 429 de
  Resend est rejoué une minute plus tard sans consommer de tentative.

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
