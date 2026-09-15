# Kesher — plateforme communautaire de l'École Abravanel

> Résumé exécutif du brief produit. Le brief complet fait foi ; ce fichier est le point d'entrée
> de toute session de travail. Mettre à jour la section « État d'avancement » à chaque fin de session.

## 1. Contexte en 10 lignes

- **École Abravanel** (Neuilly-sur-Seine, second site Levallois-Perret) : maternelle + élémentaire,
  école juive privée bilingue FR/EN. Groupe « Les Institutions Abravanel ».
- **Problème** : communication direction → parents et enseignants → parents dispersée (e-mail,
  Educartable), pas de suivi devoirs / évaluations / infos de classe, pas d'espace communautaire.
- **Kesher** (קשר, « lien ») = nom de code, renommable via `NEXT_PUBLIC_APP_NAME`.
- **Porteur** : parent d'élèves (médecin, entrepreneur, culture RGPD). Projet bénévole.
  Doit être démontrable à la direction rapidement, puis extensible.
- **Périmètre initial** : site de Neuilly, mais **multi-établissement dès le schéma** (`school_id` partout).
- **Non-objectifs MVP** : facturation, cantine, garderie, appli native (PWA), remplacement d'Educartable.
- **MVP présentable = sessions 1–8** ; V1 complète = sessions 9–15 (voir `docs/ROADMAP.md`).

## 2. Objectifs produit (ordre de priorité)

1. Canal officiel direction → parents (annonces, circulaires, documents) avec **accusé de lecture**.
2. Espace classe enseignant → parents : devoirs, cahier de vie (photos), évaluations par compétences, mots individuels.
3. Messagerie parents ↔ enseignant / direction, modérée, fils par classe, temps réel.
4. Agenda : calendrier scolaire + **fêtes juives (hebcal)**, événements, RSVP, bénévolat, ICS.
5. Communauté : groupes de classe, annuaire opt-in, entraide, anniversaires.
6. Administration simple pour une directrice non technique : classes, affectations, import CSV, promotion de niveau.

## 3. Stack imposée

Next.js 15 (App Router, RSC, Server Actions, TS strict, pnpm) · Tailwind v4 + shadcn/ui + lucide
(+ framer-motion avec parcimonie) · Supabase (Postgres, Auth magic link + invitations, Storage privé,
Realtime, Edge Functions) avec **RLS obligatoire sur toutes les tables** · migrations SQL versionnées
(`supabase/migrations`, pas de Prisma) · next-intl (`fr` défaut, `en`) · next-themes · zod partout ·
@hebcal/core · Web Push + Resend + digest (pg_cron) · Vitest / Playwright / tests RLS · Vercel (`cdg1`)

- Supabase cloud UE · ESLint / Prettier / Husky / Conventional Commits · Sentry.

## 4. Commandes

| Commande                                  | Rôle                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                                | Serveur de dev (Turbopack) sur http://localhost:3000                        |
| `pnpm build` / `pnpm start`               | Build et serveur de production                                              |
| `pnpm check`                              | lint + typecheck + format:check + tests unitaires (ce que fait la CI)       |
| `pnpm lint` / `pnpm lint:fix`             | ESLint (config Next + TS + Prettier)                                        |
| `pnpm typecheck`                          | `tsc --noEmit`                                                              |
| `pnpm format` / `pnpm format:check`       | Prettier (plugin Tailwind)                                                  |
| `pnpm test` / `pnpm test:watch`           | Vitest (`tests/unit`)                                                       |
| `pnpm test:e2e`                           | Playwright (`tests/e2e`, projets mobile + desktop). `CI=1` ⇒ `next start`   |
| `pnpm test:smoke`                         | Playwright contre un déploiement (`SMOKE_BASE_URL`, `SMOKE_PASSWORD`)       |
| `pnpm db:start` / `db:stop` / `db:status` | Stack Supabase locale (**Docker requis**)                                   |
| `pnpm db:reset`                           | Rejoue migrations + `supabase/seed/*.sql`                                   |
| `pnpm db:types` / `pnpm db:types:local`   | Génère `lib/supabase/database.types.ts` (stack Supabase / PostgreSQL local) |
| `pnpm db:test`                            | Migrations + seed + tests pgTAP sur un PostgreSQL local (sans Docker)       |
| `pnpm db:test:supabase`                   | Rejoue les tests pgTAP sur une stack Supabase déjà démarrée (`db:start`)    |
| `pnpm ops:check-bundle`                   | Origine Supabase présente dans les bundles client (auto en `postbuild`)     |
| `pnpm ops:check-help`                     | Couverture et fraîcheur de l'aide (inclus dans `pnpm check`)                |

Variables : copier `.env.example` vers `.env.local` ; sans Supabase, l'app démarre et ses clients lèvent une erreur explicite.

## 5. Structure du dépôt

```
app/            routes App Router : (auth) (parent) (teacher) (admin) (public), dev/ui
components/     ui/ (shadcn, généré) · domain/ (PostCard, AnnouncementCard…) · layouts/
lib/            supabase/ (client, server, admin) · auth/ · permissions/ · hebcal/ · notifications/ · i18n/ · env.ts
server/         actions/ (zod + rôle) · queries/ · jobs/
supabase/       config.toml · migrations/ · seed/ · functions/ (edge, Deno) · tests/rls/
messages/       fr.json · en.json (mêmes clés, test de parité dans tests/unit/i18n.test.ts)
tests/          unit/ (Vitest) · e2e/ (Playwright)
content/help/   articles d'aide (front-matter : roles, routes, topic, since, reviewed)
docs/           ROADMAP.md · DECISIONS.md (ADR) · RGPD.md · guides (sessions 14–15)
```

## 6. Conventions (non négociables)

- **Server Actions pour toute mutation** : `zod` → vérification de rôle via `lib/permissions` →
  requête → `revalidatePath` → `audit_log` si action admin / modération.
- **Aucune autorisation côté client seul** ; les RLS reproduisent la matrice des rôles (§5 du brief)
  via `can_access_class(user_id, class_id)` et `can_access_student(user_id, student_id)`.
- Aucun accès `service_role` côté client ; `lib/supabase/admin.ts` est `server-only`.
- Composants serveur par défaut ; `"use client"` uniquement pour l'interactivité.
- **Aucune chaîne en dur** : tout libellé passe par `next-intl` (`messages/fr.json` + `messages/en.json`).
- Nommage : BDD `snake_case`, TS `camelCase`, composants `PascalCase`. Code, commits, variables en anglais ;
  UI en français par défaut.
- Messages d'erreur utilisateur en français, jamais de stack trace.
- Mobile-first, tailles tactiles ≥ 44 px (`min-h-11` / `size-11`), WCAG AA, dark mode.
- Commits **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`…), vérifiés par commitlint.
- Chaque PR : description, captures mobile, checklist RLS si nouvelle table, **article d'aide écrit ou
  relu et `reviewed:` remonté** pour chaque écran touché (`pnpm ops:check-help` vert).

## 7. Rôles (rappel)

`super_admin` (plateforme) · `school_admin` (direction) · `staff` (secrétariat, pas d'accès aux évaluations)
· `teacher` (`main` / `assistant` / `specialist` par classe) · `parent` (via `student_guardians`) ·
`guardian` (lecture seule, ni évaluations ni messagerie). Un utilisateur peut cumuler des rôles.
Toute visibilité d'enfant passe par `student_guardians` + `enrollments`.

## 8. Sécurité & RGPD (données de mineurs)

Hébergement UE uniquement (Supabase `eu-west`/`eu-central`, Vercel `cdg1`, Resend UE) · pas de trackers
tiers · photos en bucket privé, URL signées 10 min, tag d'élève bloqué sans droit à l'image signé ·
familles séparées (droits indépendants, flag « restriction judiciaire ») · export / suppression de compte ·
2FA direction optionnelle par école (ADR-0030) · CSP stricte + HSTS (session 14) · audit log sur toute action admin et modération ·
durées de conservation dans `docs/RGPD.md` (session 14).

## 9. Mode opératoire

1. Travailler **session par session** (`docs/ROADMAP.md`) : un incrément déployable, testé, committé.
   Ne pas commencer la V2 avant validation du MVP.
2. Décision structurante non couverte par le brief : poser la question **avant** d'implémenter, sinon
   choisir l'option la plus simple et la consigner dans `docs/DECISIONS.md` (ADR court).
3. **Ne jamais fabriquer de contenu institutionnel** (textes de la direction, vrais noms d'enseignants) :
   données de seed clairement fictives (§14 du brief, comptes `*@demo.local`).
4. **Toute session qui ajoute ou modifie un écran met à jour l'article d'aide correspondant
   (`content/help/*.md`) et son `reviewed:`** — `pnpm check` le vérifie : un écran qu'aucun article
   n'adresse à un rôle qui l'atteint, une route disparue encore documentée, ou un article plus vieux
   que le dernier commit de l'écran qu'il décrit font échouer `ops:check-help` (ADR-0046).
5. Avant de committer : `pnpm check` puis `pnpm build` ; e2e si l'UI change.
6. Mettre à jour `CLAUDE.md` (état) et `docs/ROADMAP.md` (cases) à chaque fin de session.

## 10. État d'avancement

- **Sessions 1–2 — terminées** : bootstrap Next 15.5 + Tailwind v4 + shadcn + next-intl + next-themes +
  zod, clients Supabase, CI (lint, types, format, unit, build, e2e, database), Husky + commitlint, Vercel
  `abracom` (`cdg1`) ; palette dérivée du logo (sarcelle `#01525e`, brique `#852624`), Inter + Fraunces,
  `/dev/ui`, icônes PWA. **Validation visuelle par le porteur en attente.**
- **Session 3 — terminée (à rejouer sur Supabase)** : 10 migrations, 47 tables, 23 enums, `can_access_*`,
  132 politiques RLS (+ storage), seed fictif (137 comptes, 66 élèves), pgTAP en CI (job `database`).
- **Session 4 — code complet, validation Supabase en attente** : middleware de session, magic link (+ mot
  de passe pour la démo, ADR-0028), callbacks PKCE, onboarding avec CGU, `lib/auth` + `lib/permissions`,
  perspectives multi-rôle, coquille par rôle. E2e « invitation → 1re connexion » réservé à une stack Supabase.
- **Sessions 5–8 — code complet (MVP)** : espace `/admin` (familles, classes, utilisateurs, années, import
  CSV, journal, invitations par lots, restriction judiciaire) · annonces (Markdown, ciblage, planification,
  accusés de lecture, relance, export CSV), documents et signatures · espace classe (fil, devoirs « vu »,
  cahier de vie + droit à l'image, mots individuels, absences) · messagerie temps réel (DM, groupes de
  classe, réactions, pièces jointes, recherche, signalement, modération).
- **Session 9 — code complet** : agenda (`lib/hebcal`, `lib/calendar`), fêtes juives + Chabbat + parachah +
  fériés, vacances zone C, RSVP / jauge / liste d'attente, bénévolat, flux ICS privé, rappels J-7 / J-1.
- **Session 10 — code complet, clés réelles à valider** : livraisons planifiées par trigger selon les
  préférences, fan-out SQL, worker `/api/jobs/notifications` (push VAPID, Resend, digest, rappels), **mode
  Chabbat / heures calmes** appliqués par le worker, préférences + activation push.
- **Session 11 — code complet** : matrice de compétences par période, appréciations, publication différée
  notifiée, livret PDF `/api/livret/[studentId]` (`@react-pdf/renderer`), notes /20 optionnelles.
- **Session 12 — code complet** : annuaire opt-in, anniversaires (J-3), petites annonces modérées a priori
  (trigger), RDV parents-enseignant (`book_appointment`), formulaires / sondages avec export CSV.
- **Session 13 — code complet** : PWA (service worker hors ligne, bannière d'installation), recherche globale
  (`global_search` sous RLS), lien d'évitement + tests axe, `pnpm perf` (Lighthouse 95 / 100 / 100).
- **Session 14 — code complet, validation Supabase en attente** : `docs/RGPD.md`, export JSON et
  suppression de compte (anonymisation), purge de rétention nocturne, 2FA TOTP (obligatoire direction),
  CSP stricte à nonce, Sentry optionnel. 216 assertions pgTAP.
- **Session 15 — code et documents complets** : guides utilisateurs (`content/guides`, `/aide`, PDF),
  assistant de promotion de niveau (`promote_school_year`), `docs/DEMO.md`, `docs/DEPLOIEMENT.md`, scripts
  `ops:check-env`, `ops:storage-sweep`, `promote.sh`. 305 assertions pgTAP (revue de sécurité, ADR-0029). **V1 codée en intégralité.**
- **Session 16 — code complet, validation visuelle en attente** : refonte d'interface (ADR-0031) —
  charte « Blanc & Techelet » en clair (page quasi blanche, bleus du drapeau) et « Nuit Techelet » en sombre (ADR-0032), plafond de largeur fluide avec
  paliers `xl:`/`2xl:`, navigation par rôle (onglet **École**, pôle **Publier**, tableau de bord de
  direction, administration en quatre familles), messagerie refondue (barre de conversation, groupage,
  actions au menu, deux volets), `ContentCard` / `EmptyState` / `HubCard` uniques, six bugs d'affichage
  corrigés.
- **Session 17 — code complet, vérifiée sur la base réelle** : cahier de texte `/devoirs` (vue
  chronologique par semaine, toutes les classes du lecteur fusionnées, filtre par enfant, « vu » par
  enfant) ; navigation complète sans onglet « Plus » (compte, aide, langue et thème sous l'avatar,
  `AccountMenu`) ; onglet **Classe** pour les parents et accès direct à l'espace de classe depuis le
  tableau de bord (`ChildClassCard`) ; « Nouveau devoir » visible depuis l'accueil, le cahier de texte,
  l'onglet de classe et le pôle Publier (`?type=homework`) ; connexion par identifiant + mot de passe
  par défaut, lien magique en second, bloc « Pas de compte ? » ; **groupes de discussion** créés en
  cochant une ou plusieurs classes (`create_group_thread`, `group_target_classes`) ; **sondages dans
  les fils** (`thread_polls`, `poll_votes`, `create_thread_poll`, `vote_in_poll`, `close_poll`), avec
  « Sonder les familles » depuis un événement. Educartable retiré partout. 331 assertions pgTAP.
- **Session 18 — audit par rôle, corrections, validations Supabase rejouées** : 582 visites d'écran
  pilotées par Playwright sur une stack Supabase réelle, six rôles à 390 px et 1440 px, axe-core sur
  chacune, plus le parcours de tous les liens visibles, la profondeur réelle de chaque destination sur
  téléphone, les gestes clés joués à la main et une vérification des droits en SQL sous l'identité de
  chaque rôle. 32 défauts relevés puis corrigés. Quatre bloquants : le responsable en lecture seule se
  voyait offrir évaluations et messagerie (ADR-0033 à ADR-0036 pour les arbitrages) ; une enseignante sur
  téléphone n'atteignait ni les annonces ni les circulaires ; `is_service_role()` accordait le privilège
  de service à toute session ouverte en `postgres`, ce qui faisait passer en CI sept assertions de
  durcissement qui échouaient sur Supabase ; et **le parcours « invitation → 1re connexion » ne
  fonctionnait pas** (session implicite dans le fragment d'URL, et PKCE dont le vérificateur restait chez
  l'expéditeur). Une seule inscription ouverte par élève est désormais garantie en base. `pnpm db:test`
  réparé, `pnpm db:test:supabase` ajouté (336 assertions vertes sur les deux chemins), 28 e2e verts
  contre la stack dont l'invitation. Garde-fou de build `scripts/ops/check-bundle.mjs` en `postbuild` :
  il échoue si l'origine Supabase ou la clé anon manque des bundles client.
- **Session 19 — code complet, joué à la main sur une stack Supabase réelle** : (A) **robinet du
  dialogue** — interrupteur d'école `modules.messaging.parentToStaff` (`open`/`closed`/`scheduled`)
  avec ses publics, table `messaging_windows` (une période ouvre **ou** ferme, resserrable sur une
  classe ou une personne), application **par les RLS** via `can_post_in_thread` et
  `can_direct_message`, bouton « Annonce seule » de l'enseignant et dérogation auditée (ADR-0038),
  phrase honnête au parent avec date de réouverture et contact d'urgence, `/admin/messagerie` avec un
  interrupteur par ligne et la charge sur huit semaines, « heures de réponse » remplacée par un fait
  (ADR-0037). (B) **pointeuse** (ADR-0039) — `attendance_lists` / `attendance_sessions` /
  `attendance_records`, droit de pointer accordé liste par liste, « qui récupère » limité aux
  responsables autorisés et refusé en base sous restriction judiciaire, grille à grandes vignettes,
  **file hors ligne** rejouée dans l'ordre, liste d'une sortie créée depuis l'agenda, export CSV,
  rétention 12 mois. (C) **rabot** — bloc « Aujourd'hui » sur l'accueil du parent (la carte d'accusés
  de lecture y est repliée), « Bravo » d'une tape. 405 assertions pgTAP vertes sur les deux chemins.
- **Session 20 — code complet, joué à la main sur une stack Supabase réelle** : les trois écarts avec
  Educartable retenus et chiffrés en session 19, livrés d'un bloc. (1) **Emploi du temps**
  (`class_timetable`, `class_week`, onglet de classe) : une semaine type — jour, deux heures, matière,
  intervenant, salle — lue comme une liste de jours, écrite par l'équipe de la classe et le
  secrétariat, un créneau ne pouvant nommer qu'un intervenant de la classe (ADR-0040).
  (2) **Mot d'excuse signé du téléphone** (`absence_justifications`, `declare_and_sign_absence`) :
  le mot et l'absence dans une seule transaction, nom tapé, horodatage imposé par la base, signature
  jamais réécrite ; **signer soumet une justification, l'école l'accorde** — `absences.status` reste
  hors de portée de la famille (ADR-0041). (3) **Suivi des retards** (`late_report`) : addition des
  deux registres, le déclaré et le constaté, gardés distincts, onglet réservé à l'équipe, export CSV,
  aucune table nouvelle (ADR-0042). 436 assertions pgTAP vertes sur les deux chemins.
- **Correctif du 2026-09-11** : la pointeuse était introuvable en production — `/pointage` renvoyait à
  l'accueil sans un mot tant qu'aucune liste n'existait, et les listes de démonstration ne vivent que
  dans le seed. La page dit maintenant ce qui manque, la carte d'accueil laisse une route au téléphone,
  et `/admin` affiche un chiffre à côté de Pointage.
- **Session 21 — code complet ; parcours à six rôles rejoué en test, pas encore sur une stack Supabase** :
  l'aide passe de trois guides monolithiques (session 15, cinq sessions de retard, trois rôles sur six)
  à **43 articles courts** (`content/help/*.md`) à front-matter — `title`, `roles`, `routes`, `topic`,
  `keywords`, `since`, `reviewed`. `/aide` ne montre que ce qui concerne le lecteur, rangé par thème
  (Se connecter · Au quotidien · Publier · Administrer · Mes données) ; un bloc `:::roles` réserve une
  phrase à une partie de l'audience, si bien qu'un responsable en lecture seule ne lit jamais « ouvrez
  la messagerie » (ADR-0043 à ADR-0045). Tout ce qu'ont ajouté les sessions 16 à 20 est couvert.
  **Garde-fou de fraîcheur** `pnpm ops:check-help`, dans `pnpm check` et en CI (ADR-0046) : il déduit
  l'audience de chaque écran de la garde appelée par sa page, et **échoue** si un rôle qui atteint un
  écran n'a aucun article, si un article documente une route disparue, ou si son `reviewed:` précède le
  dernier commit de l'écran décrit. Un « ? » dans chaque en-tête ouvre l'article de l'écran courant ;
  `/aide/quoi-de-neuf` liste les nouveautés du rôle (ADR-0050). **Recherche** en direct sur `/aide`,
  sans accents ni casse, extraits surlignés, état vide qui propose une sortie ; `/recherche` remonte les
  articles à côté des annonces. PDF « mon guide » par rôle (ADR-0048) — au passage, un vrai défaut de
  mise en page `@react-pdf` corrigé. 156 tests unitaires, 436 assertions pgTAP inchangées et vertes.
- **Session 22 — code complet, validation visuelle en attente** : refonte purement graphique
  (ADR-0051), « le trait plutôt que la boîte ». Fraunces cède la place à **Newsreader** (une seule serif
  éditoriale, à axe optique, pour les titres et la prose ; Source Serif 4 supprimée) et la serif devient
  **la voix de l'école** quand le sans reste **l'interface**. L'échelle typographique est recoupée dans
  `@theme` : les crans de titre perdent 20 à 30 %, le texte courant ne bouge pas, chaque cran porte son
  interligne et son approche. `--radius` passe de 14 px à 8 px, l'ombre cède au filet (jeton `--rule`
  pour les séparateurs internes), et `--surface` / `--secondary` / `--accent` / `--input` perdent de la
  chroma à luminance identique — le SC 1.4.11 tient, le bleu ne crie plus. Trois composants partagés
  absorbent ce qui était recopié : `SectionHeader` (vingt et un `<h2>` à six tailles), `RowList` / `Row`
  (neuf listes écrites à la main), `FilterChip` / `FilterChips` (six rangées de pilules bleues pleines).
  Les onglets se marquent d'un trait, plus d'un aplat. `/dev/ui` gagne une section **Anatomie d'écran**
  et un spécimen de l'échelle. Aucune route, aucun libellé et aucun droit ne bougent.
- **Session 23 — audit de composition sur stack Supabase réelle, code complet** (ADR-0052). La
  session 22 n'avait jamais vu les écrans connectés ; montée cette fois (Docker + `supabase start` +
  seed), elle a montré que le défaut restant était la **composition**, pas le détail : aucune colonne de
  lecture (tout s'étalait sur 1 760 px), la grille de cartes comme réponse à tout (66 élèves en 66
  cartes, 11 152 px), et une icône par ligne (sept dans la barre du haut). Trois largeurs choisies par
  le genre de l'écran (`Column` : `text` 42 rem, `index` 58 rem, `full` pour les consoles) ; `IndexList`
  pour les publications, `Table` pour les registres, les hubs en sommaires, le tableau de bord en
  planche de chiffres ; une circulaire composée comme une lettre, avec l'accusé et les pièces jointes en
  appareil à côté du texte ; icônes décoratives et pastilles retirées (la marque « ceci vous attend »
  devient une barre dans la marge). **Défauts trouvés en regardant** : le marqueur d'urgence était
  dessiné hors d'une carte qui coupe ce qui déborde — invisible partout ; la description de l'accueil
  parent répétait le libellé de la section juste dessous ; un article d'aide décrivait une carte
  fusionnée depuis la session 19. **Vérifications inédites ici** : 28 e2e verts _invitation comprise_,
  436 assertions pgTAP, `check-bundle` confirmé sur un vrai bundle, axe à 0 violation sérieuse sur neuf
  écrans connectés en clair et en sombre. Au passage, `015_attendance.sql` échouait toutes les nuits
  entre 22 h et minuit UTC (occurrence datée à Paris, comparée à un `current_date` serveur) — corrigé.
- **Session 24 — revue d'architecture, code complet** (ADR-0053). Un onglet doit mener quelque part
  qu'aucun autre ne mène. Sur le téléphone d'un parent d'un enfant, **deux des cinq onglets ouvraient
  le même écran** — « Devoirs » et « Ma classe », qui atterrissait sur les devoirs de la classe :
  séquelle de la session 16 (l'atterrissage) que la session 17 (l'onglet Devoirs fusionné) n'avait pas
  revue. L'espace de classe ouvre désormais sur le **cahier de vie**, ses onglets sont rangés par
  fréquence d'ouverture, « Formulaires » sort de Communauté (il figurait aussi dans École, qui contient
  Communauté), et École est rangée par fréquence. Le déplacement a mis au jour un défaut de fond : le
  cahier de vie **ne montrait que les billets portant une photo et n'affichait jamais leur texte** —
  depuis la suppression de l'onglet « Fil », un billet sans photo n'existait nulle part. Corrigés
  aussi : le compteur « N formulaires à remplir » comptait pour l'équipe les formulaires que personne
  n'avait remplis, et l'accueil de l'enseignante répétait en description le libellé de sa première
  section. **Reste à faire, signalé et non fait** : l'accueil de l'enseignante n'a pas d'équivalent du
  bloc « Aujourd'hui » du parent ni de la file d'attente de la direction — cela demande de nouvelles
  requêtes, donc une session de fonctionnalité, pas de mise en forme.
- **Session 25 — hiérarchie de lecture, code complet** (ADR-0054). La première passe graphique avait
  rapetissé la navigation en même temps que le contenu : sur l'espace de classe, le titre d'une carte
  du cahier de vie sortait plus gros que les onglets qui mènent aux devoirs et aux absences, et
  l'équipe enseignante occupait trois lignes de corps de texte juste au-dessus d'eux. L'interface se
  lit désormais en **deux couches** : la **structure** parle le plus fort — onglet 15 px, `semibold` +
  filet de 2 px à l'état actif, libellé de section 13 px en capitales, jamais sous `foreground/70` ;
  le **contenu** passe dessous — titre de carte 15 px, texte 14 px, métadonnée 11–12 px, corps des
  publications en `<Markdown size="compact">`. Un en-tête porte au plus une phrase de description ; un
  fait sur l'écran (l'équipe d'une classe) devient une `caption` d'une ligne coupée. La mesure de la
  session 23 n'était appliquée que par une poignée d'écrans : **les 53 autres s'étalaient sur 1 760 px**
  — chaque page porte maintenant sa `Column` (`text` / `index` / `full`), l'aide comprise, qui était
  centrée. Six listes de cartes bordées redeviennent index ou `RowList`, la page d'aide passe de
  vingt-six encadrés à un sommaire, un statut n'est nommé que s'il fait exception. Deux régressions de
  contraste introduites par la passe elle-même (onglet au repos 4,38:1, caption 4,02:1) trouvées par
  axe et corrigées, et un `not-found` propre au groupe `(app)` : une classe qui n'est pas la vôtre ne
  fait plus disparaître la barre de navigation. 28 e2e verts (invitation comprise), 156 tests
  unitaires, axe à 0 violation sérieuse sur douze écrans connectés en clair et en sombre, à 390 et
  1 440 px.
- **Session 26 — une liste de contrôle tierce, et ce qu'elle a trouvé** (ADR-0055). Le corpus de
  `ui-ux-pro-max` (MIT) est vendorisé dans `.claude/skills/ui-ux-pro-max/` **sans ses scripts
  Python**, et `.claude/skills/design-review/SKILL.md` pose la doctrine de Kesher et arbitre : en cas
  de contradiction, l'ADR gagne, et son générateur de design system n'est jamais lancé ici. Huit
  défauts corrigés. Trois par la liste, qu'aucune des quatre sessions de design n'avait vus :
  **Tailwind v4 a retiré le `cursor: pointer` des boutons** (toute l'application répondait au
  pointeur comme un paragraphe, pendant que les liens voisins montraient une main) ; **SC 2.4.11
  « Focus Not Obscured » échouait sur tout le téléphone** (tabuler collait l'élément au bord, donc
  sous la barre du bas : 57 px d'une ligne de 63 px, anneau de focus compris — corrigé par
  `scroll-padding`) ; et les deux barres translucides laissaient lire le contenu au travers, devenues
  opaques. Cinq en regardant les écrans : la **grille d'évaluations d'une classe sans référentiel**
  affichait une colonne de noms, une légende et « Enregistrer la grille » sous une grille vide — le
  seed ne remplit que PS, MS et GS, donc six niveaux sur neuf avaient l'air cassés ; chaque colonne
  de la matrice répétait le domaine déjà porté par son en-tête puis tronquait ce qui distingue les
  colonnes ; la matrice, console de vingt et une colonnes, était enfermée dans la colonne de lecture
  de 58 rem (les onglets de classe portent désormais chacun leur `Column`) ; la fiche élève étirait
  sa carte de gauche sur sept cents pixels de blanc ; et neuf grilles à deux panneaux de
  l'administration faisaient la même chose. Vérifié : `pnpm check`, `pnpm build`, 28 e2e,
  436 assertions pgTAP, axe à 0 violation sérieuse sur vingt-six écrans en clair et en sombre.
- **Session 27 — balayage terminé** (ADR-0056). La session 26 n'avait regardé qu'une trentaine
  d'écrans sur soixante-huit ; les autres y sont passés, plus le mode sombre à l'œil et les rôles
  `staff` et `super_admin` jamais parcourus depuis la session 22. Deux barres translucides
  identiques à celles déjà corrigées dormaient encore dans l'en-tête public et le bandeau de la
  pointeuse. Six défauts de plus, tous invisibles pour axe : sur **`/famille`**, la liste des
  destinations était rendue hors de la carte de l'enfant, si bien que deux enfants aux équipes de
  tailles différentes donnaient deux listes décalées ; **`field-sizing: content` neutralisait
  l'attribut `rows`**, et le corps d'une circulaire s'ouvrait sur quatre lignes au lieu de dix ; la
  **promotion de niveau** disait ce qui manque sans offrir la porte ; l'**agenda** dessinait un filet
  sous chaque jour sans événement, suivi du blanc d'une journée (le filet appartient maintenant au
  jour, qui est l'unité de la liste) ; le **tableau de bord du secrétariat** peignait son seul lien
  comme du texte gris ; et l'**échec de connexion** était une impasse sur l'écran le plus utilisé de
  l'application — il nomme désormais le lien par e-mail, qui est la sortie puisqu'il n'y a pas de
  réinitialisation (ADR-0028). Vérifié : `pnpm check`, `pnpm build`, 28 e2e, axe à 0 violation
  sérieuse. **Validation visuelle par le porteur : c'est le seul point qui reste.**
- **Session 28 — ce que les familles reçoivent** (ADR-0057). Sept e-mails et deux PDF sortent vers
  les familles ; aucune des six sessions de design ne les avait ouverts. Tous étaient restés peints
  en **sarcelle `#01525e` sur fond crème** — la charte des sessions 1–2, remplacée en session 16. Ils
  portent désormais la même anatomie que l'application : surtitre bleu qui nomme l'expéditeur, titre
  en serif (Georgia dans les e-mails, Times-Roman dans les PDF — aucune police téléchargée), texte en
  sans, filet, pied muet. Quatre défauts de contenu, plus graves que les couleurs : l'**e-mail
  d'invitation**, le tout premier message qu'une famille reçoit, affirmait « vous n'avez pas de mot
  de passe à retenir », faux depuis la session 17 ; le **livret** répétait le domaine dans chaque
  ligne de compétence sous un titre qui le portait déjà, et imprimait « Période : Période 1 » ; le
  **guide PDF** imprimait son sous-titre à travers les jambages de son titre (une ligne de 22 points
  héritait du `lineHeight: 1.4` de la page). Vérifié : `pnpm check`, `pnpm build`, 28 e2e, et les
  neuf documents rendus puis regardés un par un.
- **Session 29 — ce qu'une enseignante a trouvé en se servant de l'application** (ADR-0058 à
  ADR-0060), joué sur une stack Supabase réelle. **Le fond redevient blanc** et le bleu passe en
  touches : page et carte en blanc pur, le filet dessine seul le plan, et `--muted` / `--accent` /
  `--secondary` / `--surface` reprennent la chroma que la session 22 leur avait ôtée puisqu'ils ne
  reposent plus sur une page bleue (le thème sombre ne bouge pas). Sept points relevés par l'usage,
  tous livrés : **Publier** ne rebondit plus dans la classe et liste ce qu'on publie — billet,
  devoir, mot — la classe n'étant demandée qu'au pluriel ; **une publication, une catégorie** — le
  cahier de vie absorbe Info et Rappel, filtrables par pastilles, alors que ces deux valeurs étaient
  écrites depuis la session 5 et **lues par aucun écran** ; les **onglets de classe** se rangent en
  deux familles, _Classe_ et _Suivi_ ; **modifier une publication** devient atteignable (possible en
  base depuis la session 5, jamais offerte) ; un **mot individuel** part à plusieurs élèves ou à
  toute la classe, une ligne par élève, chaque famille son accusé ; **la porte de chacun**
  (`profiles.accepts_parent_dm`) laisse un enseignant, le secrétariat ou la direction refuser les
  messages directs des familles **sans jamais bloquer un collègue**, appliqué par
  `can_direct_message` et `thread_messaging_state` ; l'**accueil de l'enseignante** ouvre enfin sur
  « Ce qui vous attend » et « Dans vos classes » (dette signalée en session 24). La repasse sur les
  rôles a trouvé le défaut le plus grave de la session : **`getMyChildren()` ne filtrait pas sur le
  lecteur** — il lisait les liens de responsabilité que les RLS lui laissent voir, si bien qu'une
  enseignante se voyait offrir dans son cahier de texte une pastille de filtre et un bouton « vu »
  par élève de sa classe, chaque prénom répété une fois par responsable ; plus un responsable en
  lecture seule prié de signer ce que la base lui refuse, trois grilles à deux panneaux encore
  étirées, la file d'attente de la direction redessinée sur le composant commun, et le pictogramme
  de type retiré des cartes du cahier de vie. Vérifié : `pnpm check`, `pnpm build`, 455 assertions
  pgTAP, axe à 0 violation sérieuse en clair et en sombre. **Validation visuelle par le porteur en
  attente.**
- **Session 30 — la latence** (ADR-0061). Signalement du porteur : « le site est lent, il y a de la
  vraie latence dans les clics ». Mesuré sur un build de production local contre la stack Supabase
  (le mandataire du bac à sable ajoute une seconde à tout, la production n'était pas mesurable de
  là), les allers-retours comptés dans le journal de Kong. **Un seul affichage de l'accueil coûtait
  43 appels Supabase, dont 28 au serveur d'authentification** : `auth.getUser()` n'est pas une
  lecture de cookie mais un appel HTTP à GoTrue — 53 ms mesurés avec la base sur la même machine,
  contre 22 ms pour une requête PostgREST — et l'application en faisait quatre par rendu, multipliés
  par le préchargement de chaque lien visible. Remplacé par `getClaims()`, qui vérifie la signature
  ES256 **localement** contre le JWKS mis en cache (le rafraîchissement des cookies est inchangé) ;
  `listFactors()` et la pastille des messages deviennent deux fonctions SQL (`mfa_enrolled()`,
  `unread_message_count()`) ; et la coquille n'attend plus le profil pour demander les textes légaux
  et l'état 2FA. **Résultat : 16 appels au lieu de 43, aucun au serveur d'auth, et 62–190 ms de
  temps serveur par route au lieu de 150–270.** Le clic était par ailleurs **muet** : un `loading.tsx`
  a été écrit, mesuré, puis **retiré** — il répond en 35 ms mais fait arriver le contenu trois fois
  plus tard (392–871 ms contre 139–206) parce qu'il coupe la navigation en deux allers-retours ;
  `LinkPending` (`useLinkStatus`) donne le même retour en 24–34 ms sans toucher au flux de données.
  Le préchargement est retiré des liens de contenu et conservé sur la navigation. **Consigné comme
  leçon de méthode** : pendant plusieurs tours le banc d'essai servait un build supprimé (chunks en
  `text/html`, aucune hydratation), ce qui avait déjà fait trancher l'A/B dans le mauvais sens — le
  script de banc refuse maintenant de rendre la main tant qu'un chunk n'est pas servi comme du
  JavaScript. 463 assertions pgTAP, 28 e2e, axe à 0 violation sérieuse. **Reste à vérifier côté
  Supabase : le projet de production doit émettre des jetons asymétriques (Auth → JWT Keys), sinon
  `getClaims()` retombe sur `getUser()` et le gain est nul.**
- **Session 31 — un aller-retour pour la coquille** (ADR-0062). Nouveau signalement : « c'est encore
  franchement lent ». **Éliminé d'abord côté plateforme** : le projet Supabase répond en 242 ms depuis
  l'environnement de travail contre 226 et 230 ms pour deux projets de référence en `eu-west-3` et
  `eu-north-1` — il est donc bien en Europe, à côté des fonctions Vercel qui tournent en `cdg1` ; les
  **149 politiques RLS** enveloppent toutes `auth.uid()` dans un `(select …)`, donc pas d'évaluation
  par ligne ; et les 36 clés étrangères sans index sont des colonnes d'audit sur des tables de
  quelques centaines de lignes. **Corrigé ensuite** : `session_context()` rend en **une** requête ce
  qui en coûtait **huit** sur chaque page (profil, coordonnées, adhésions, écoles, textes légaux,
  acceptations, 2FA, messages et notifications non lus) — A/B sur la même machine, la fonction
  désactivée en base pour comparer honnêtement : `/accueil` passe de 18 à 10 appels, `/devoirs` de 13
  à 5, `/messages` de 11 à 3, avec 9 à 13 % de temps en moins là où le réseau est pourtant gratuit ;
  et `staleTimes.dynamic: 30` arrête de **jeter** le résultat de chaque préchargement (Next 15 le met
  à 0 par défaut), si bien qu'une page déjà visitée se rouvre depuis le cache client en 78 ms au lieu
  de 190. **Repli obligatoire** : les migrations SQL partant à la main avant le déploiement, tout le
  chemin retombe sur les requêtes d'origine si la fonction n'est pas encore en base — sans quoi une
  fonction absente aurait déconnecté tout le monde. Corollaire : **les gains SQL des sessions 30 et 31
  n'existent en production qu'une fois la migration appliquée**, et tant qu'elle ne l'est pas,
  `mfa_enrolled()` répondait « pas de facteur » à tout le monde, ce qui désactivait la vérification
  2FA de la direction — le repli corrige cela aussi. 468 assertions pgTAP sur les deux chemins,
  28 e2e, `pnpm check` vert. **Restent au porteur : appliquer les migrations
  (`scripts/ops/apply-migrations.sh`), et vérifier le plan Supabase ainsi que les clés JWT
  asymétriques.**
- **Vérification de production — 2026-09-15** (ADR-0063). Première lecture de la base et du
  déploiement hébergés (jusque-là tout était mesuré en local). Les trois points laissés au porteur en
  session 31 sont levés : **les 44 migrations sont appliquées**, dont les trois des sessions 29–31 ;
  **les clés JWT sont asymétriques (ES256)**, donc `getClaims()` vérifie en local sans repli ; et
  **la formule n'est pas en cause** — 21 Mo de base pour 224 Mo de `shared_buffers`, 16 à 34 ms de
  temps d'origine médian, aucune requête lente en 24 h, 15 connexions sur 60. Surtout, les journaux
  datent le malentendu : le test qui a motivé « c'est trop long » a eu lieu entre 11:00 et 12:00, et
  **le correctif de la session 30 n'a été déployé qu'à 14:24**, celui de la session 31 à 15:26. Les
  journaux prouvent le gain — **231 appels à `/auth/v1/user` pendant l'heure de test, zéro ensuite** —
  et `session_context()` n'a encore jamais été appelé, faute de navigation depuis. Défaut trouvé en
  chemin et corrigé : **63 % de tout le trafic Supabase** venait du worker de notifications repassant
  chaque heure 197 livraisons qu'il ne peut pas envoyer, une requête par ligne ; `skip()` les
  repoussait d'une heure sans fin, car `MAX_ATTEMPTS` compte des échecs et **un canal non configuré
  n'échoue jamais, il attend**. `skip()` a désormais un plafond d'âge de sept jours
  (`lib/notifications/schedule.ts`, trois tests), ce qui évite aussi que tout l'arriéré parte d'un
  bloc le jour où Resend sera branché. Aucune ligne modifiée à la main en base : l'arriéré s'éteint
  en passant l'horizon. **Reste au porteur : rouvrir le site et dire ce qu'il ressent.**
- **Le préchargement, mesuré sur une vraie session — 2026-09-15** (ADR-0064). Le porteur décrit le
  bon symptôme : « le premier clic est long (0,5 s), les suivants quasi instantanés ; si j'attends un
  peu, ça redevient long ». Ce n'est pas la base : pendant cette session, chaque page ne coûte que
  **2 à 6 appels Supabase**, `session_context()` compris (14 à 81 ms) — la session 31 tourne donc bien
  en production. Les journaux Vercel montrent le vrai coût : pour une poignée de pages ouvertes à la
  main, **des dizaines de routes sont rendues côté serveur** — cinq `/messages/<id>`, trois
  `/agenda/<id>`, les sept onglets de deux classes et **neuf articles `/aide/*`** que personne n'a
  demandés. Ce sont des préchargements, et chacun est une invocation complète. L'ADR-0061 disait déjà
  « préchargement retiré des liens de contenu, conservé sur la navigation » ; la règle n'avait jamais
  atteint `IndexEntry`, `ContentCard` ni `HelpHint` — le « ? » de **chaque** en-tête. Sur Hobby la
  concurrence se paie en instances : quinze préchargements simultanés réveillent des fonctions froides
  (le `jwks.json` redemandé le trahit) qui disputent le budget à la navigation attendue.
  `prefetch={false}` sur ces trois composants ; la barre du bas et les onglets de classe gardent le
  leur. **Compromis assumé** : ouvrir une conversation depuis la liste redevient un aller-retour, avec
  `LinkPending` pour la réponse immédiate. **Non corrigé** : le démarrage à froid lui-même (levier =
  Fluid Compute dans la console Vercel, pas le code), et le middleware qui s'exécute sur l'Edge à
  Londres alors que fonctions et base sont à Paris. **À vérifier sur la prochaine session réelle.**
- **Le chiffre, enfin — 2026-09-15** (ADR-0065). L'ADR-0064 n'a pas suffi : les préchargements de
  listes ont bien disparu des journaux, mais le porteur trouve l'application **toujours aussi lente**,
  et Fluid Compute était **déjà activé**. Mesuré enfin de bout en bout sur la production, temps de
  connexion retranché : `/connexion` **à froid 1 298 ms**, **à chaud 227–273 ms**, statique
  48–175 ms. Une page dynamique à chaud ne coûte donc que 150 à 200 ms de plus qu'un fichier
  statique — c'est sain ; **tout le grief est le démarrage à froid, 1,1 s**. Le mécanisme, trouvé en
  croisant deux faits : l'ADR-0061 a **supprimé `loading.tsx`** (il n'en reste aucun) et les liens de
  navigation prennent le préchargement par défaut. Or, pour une route dynamique, ce défaut s'arrête à
  la première frontière `loading.tsx` — sans frontière, **Next rend la page entière**. Observé, pas
  lu : les routes préchargées interrogeaient vraiment Supabase. D'où la boucle — une trentaine de
  rendus complets simultanés par vue de page, autant d'instances ouvertes, la plupart à froid, puis
  récupérées ; et pendant la rafale les temps Supabase **triplent** (14–81 ms → 150–344 ms).
  `prefetch={false}` sur la barre de navigation, les onglets de classe et les entrées d'agenda :
  **plus aucun lien ne précharge**. **Compromis assumé** : les clics suivants, que le porteur trouvait
  « quasi instantanés », coûteront ~230 ms — on échange un pic à 1,3 s contre une constance à 230 ms,
  et c'est la variance qui était le grief. **Piste suivante si insuffisant** : remettre un
  `loading.tsx`, qui rendrait le préchargement bon marché sans renoncer au clic instantané — mesuré,
  pas décrété.
- **Le poids du démarrage à froid — 2026-09-15** (ADR-0066). L'ADR-0065 expliquait la _fréquence_
  des démarrages à froid, pas leur _coût_ : 978 à 1 820 ms à froid contre 205 à 305 ms à chaud. Ce
  coût-là se paie en octets — téléchargés, décompressés, analysés avant le premier octet de réponse.
  **(1)** `instrumentation.js`, que Next exécute au démarrage de **chaque** fonction, pesait
  **1 782 579 octets** : tout le SDK Sentry. Le fichier disait vrai (« no-op sans `SENTRY_DSN` ») et
  `Sentry.init` le garantit **à l'exécution**, mais `import * as Sentry` en tête est **statique**.
  Passé en imports dynamiques conditionnés au DSN : **1 782 579 → 1 832 octets**.
  `app/global-error.tsx` l'importait aussi statiquement — et cette frontière d'erreur est dans le
  graphe de **toutes** les routes ; même traitement (au passage, son bouton était resté en sarcelle
  `#01525e`, charte des sessions 1–2 que la session 28 avait traquée dans les e-mails et les PDF en
  manquant cet écran). **(2)** En pesant non plus les morceaux mais **les fonctions** (traces
  `.nft.json`), quatre routes sortaient à **21,7 Mo** quand les autres tenaient sous 6 :
  **`libvips-cpp.so`, 15,87 Mo**, la bibliothèque native de `sharp`. Deux chemins l'amenaient là où
  aucune image n'est traitée : `MediaGrid`, composant d'**affichage**, allait chercher
  `blurhashAverageColor` dans `lib/media.ts` (c'est une lecture base83 sur quatre caractères — elle
  vit désormais dans `lib/blurhash.ts`) ; et surtout `saveClassPost`, seule action appelant
  `processImage`, **cohabitait** avec `toggleHomeworkSeen` et consorts — or une Server Action est
  empaquetée dans **chaque route qui l'importe**, donc cocher « vu » embarquait libvips.
  `saveClassPost` part dans `server/actions/class-post-publish.ts`. **Mesuré : `/devoirs` 21,54 →
  4,91 Mo, `/classes/[id]/cahier` 21,75 → 5,13 Mo, `/classes/[id]/devoirs` 21,75 → 5,13 Mo** — les
  trois écrans les plus ouverts perdent **77 %** de leur fonction ; `/publier` garde ses 21,7 Mo, il
  envoie vraiment des photos. **Leçon, la même qu'à l'ADR-0061** : deux fois ce jour-là j'ai conclu
  d'un indice au lieu de mesurer — la rafale de préchargements, puis des noms de symboles lus dans un
  paquet minifié (`createTransport` était l'API de transport **de Sentry**, pas nodemailer, et
  `Helvetica` une pile de polices CSS). Ce qui a tranché, c'est de peser les fonctions une par une.
- **Ce qu'un clic coûte vraiment — 2026-09-15** (ADR-0067). Sixième passe, la première à regarder
  une navigation **authentifiée depuis le navigateur** : journaux Supabase de la vraie session du
  porteur à la milliseconde, `pg_stat_statements`, un banc local (stack Docker + build de production +
  Chromium piloté par CDP, latence émulée) qui décompose chaque clic, et une sonde `curl` sur la
  production après des pauses de 2 à 240 s. **Le rythme « instantané / lent à trente secondes » est
  `staleTimes.dynamic: 30`** (session 31), reproduit au banc : 47 ms depuis le cache à 26 s, 232 ms et
  neuf appels à 30 s ; passé à **300**. **Le clic non caché coûte ce que coûte la base** : sur la
  session du porteur, l'accueil parent = `session_context` 50 ms → sept requêtes en parallèle
  (85–208 ms) → `events` **seule, après**, 296 ms = **620 ms de base** (937 ms sur une instance neuve).
  « Supabase hors de cause » était faux à cette échelle : `events` 239 ms et `student_guardians`
  215 ms de moyenne sur des tables de cent lignes, **cinq à huit fois plus lentes que les mêmes
  requêtes en local** — du calcul de politiques RLS par ligne sur le palier de calcul gratuit, qui se
  congestionne par vagues. **Le préchargement n'a jamais rendu la page** : vérifié au `curl`, un
  préchargement renvoie 257 octets et zéro appel, une navigation 116 Ko et six ; les ADR-0064 et 0065
  s'étaient trompés de mécanisme, et il restait sept liens préchargés sur `/messages` — `next/link` est
  désormais enveloppé (`components/ui/link.tsx`, `prefetch={false}` par défaut, ESLint l'impose).
  **`loading.tsx` mesuré et écarté** : squelette à 70–90 ms mais contenu à 360–380 ms au lieu de
  105–160 — le seuil anti-clignotement de React (300 ms), qui explique les chiffres de l'ADR-0061.
  Les instances neuves ne viennent pas de l'inactivité (sonde chaude après 240 s) mais de la
  répartition des requêtes simultanées : quatre instances en 53 s, six rafraîchissements de jeton en
  1,3 s depuis Londres à l'ouverture. **Corrigé** : cache à cinq minutes, aucun lien ne précharge, le
  rail d'événements de l'accueil part avec la première vague (620 → ~330 ms de base projetés). **Reste,
  chiffré pour une session de base** : une requête par écran (motif `session_context`), le palier de
  calcul, des politiques en ensembles (essayé en local : 9,3 → 6,6 ms, modeste). **Ce qui n'a pas été
  possible** : se connecter à la production (mot de passe propre au staging, connecteur Supabase en
  lecture seule, journaux Vercel refusés par le bac à sable) — la partie navigateur vient du banc.
- **Production saine** (vérifiée par le porteur le 2026-09-10) : une conversation s'ouvre sur
  `abracom.vercel.app`, donc le bundle navigateur porte bien la configuration Supabase — c'est le seul
  écran qui utilise le client Supabase du navigateur, et donc le seul test qui tranche. Un premier
  diagnostic de la session 18 concluait à tort à une production cassée : il ne lisait que les chunks
  référencés par `/connexion`, où l'origine Supabase n'a aucune raison de figurer. Le garde-fou
  `check-bundle` balaie tout `.next/static` et arrêtera un build de ce genre s'il se produit un jour.
- **Suite** : brancher Resend et décommenter les modèles d'e-mails de `config.toml`, chronométrer
  l'import CSV, valider l'upload Storage et le push VAPID, dérouler la démo. Les trois écarts avec
  Educartable retenus sont livrés (session 20) ; le trombinoscope reste écarté tant que les droits à
  l'image ne sont pas majoritairement signés, et objets trouvés / covoiturage existent déjà comme
  catégories des petites annonces — voir `docs/ROADMAP.md`, section « Écarts avec Educartable ».
- Questions ouvertes (§15 du brief) : voir `docs/ROADMAP.md`, section « Questions ouvertes ».
