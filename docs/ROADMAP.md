# Feuille de route — Kesher

Une session ≈ 2–4 h de Claude Code, chacune **déployable, testée, committée**.
**MVP présentable à la direction = sessions 1–8.** Sessions 9–15 = V1 complète.

| #   | Livrable                                                                                                                     | Definition of done                                      | État |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---- |
| 1   | Bootstrap : Next 15, Tailwind, shadcn, Supabase local, CI lint/test, Vercel preview, CLAUDE.md, ROADMAP                      | `pnpm dev` OK, déploiement preview vert                 | ✅   |
| 2   | Identité visuelle : extraction palette logo, tokens, thème clair/sombre, page de style `/dev/ui`                             | Validation visuelle par le porteur                      | ⬜   |
| 3   | Schéma BDD complet + RLS + `can_access_*` + seed fictif (1 école, 6 classes PS→CE1, 12 enseignants, 60 familles) + tests RLS | Tests RLS verts pour les 6 rôles                        | ⬜   |
| 4   | Auth : magic link, invitations, onboarding parent/enseignant, CGU versionnées, profil, multi-rôle                            | Flux e2e « invitation → 1re connexion »                 | ⬜   |
| 5   | Admin : écoles, années, classes, affectations, import CSV, invitations en masse                                              | Directrice fictive importe 60 familles en < 2 min       | ⬜   |
| 6   | Annonces + accusés de lecture + documents + signatures                                                                       | Annonce ciblée classe avec relance des non-lecteurs     | ⬜   |
| 7   | Espace classe : fil, devoirs, cahier de vie (upload photos), mots individuels                                                | Enseignant publie, parent voit et coche « vu »          | ⬜   |
| 8   | Messagerie temps réel : DM, fils officiels, groupes de classe, modération, signalement                                       | 2 navigateurs, échange instantané, modération OK        | ⬜   |
| 9   | Agenda : hebcal, événements, RSVP, créneaux bénévolat, ICS                                                                   | Abonnement ICS visible dans Google Calendar             | ⬜   |
| 10  | Notifications : push, e-mail Resend, digest, préférences, **mode Shabbat**                                                   | Push reçu ; aucun envoi pendant fenêtre Shabbat simulée | ⬜   |
| 11  | Évaluations par compétences + livret PDF ; absences                                                                          | Livret PDF généré pour un élève fictif                  | ⬜   |
| 12  | Communauté : annuaire opt-in, petites annonces, anniversaires, RDV parents-prof, formulaires                                 | Réservation de créneau fonctionnelle                    | ⬜   |
| 13  | PWA, offline, recherche globale, accessibilité, performance (Lighthouse ≥ 90 mobile)                                         | Installable iOS/Android                                 | ⬜   |
| 14  | RGPD : export, suppression, docs/RGPD.md, audit log, 2FA admin, CSP                                                          | Checklist §9 cochée                                     | ⬜   |
| 15  | Guides utilisateurs (PDF + pages in-app), démo scénarisée, script de bascule staging→prod, promotion de niveau               | Démo de 15 min prête pour la direction                  | ⬜   |

## Session 1 — détail

- [x] Next.js 15.5 (App Router, TypeScript strict, `noUncheckedIndexedAccess`), pnpm 10, Node 22
- [x] Tailwind CSS v4 + shadcn/ui (preset Nova, base Radix, variables CSS) + lucide-react
- [x] next-intl sans préfixe d'URL (cookie `NEXT_LOCALE`, `fr` défaut, `en`) + test de parité des catalogues
- [x] next-themes (clair / sombre / système) + bascule de langue et de thème dans l'en-tête
- [x] Validation des variables d'environnement avec zod (`lib/env.ts`, `lib/env.server.ts`)
- [x] Clients Supabase navigateur / serveur / admin (`server-only`), résolus paresseusement
- [x] `supabase init` → `supabase/config.toml` (projet `kesher`, seed `supabase/seed/*.sql`)
- [x] Arborescence §11 (`app`, `components`, `lib`, `server`, `supabase`, `messages`, `docs`, `tests`)
- [x] En-têtes de sécurité de base (nosniff, frame DENY, referrer, permissions, HSTS), `robots` disallow
- [x] Pages `not-found` / `error` en français, sans stack trace
- [x] ESLint (Next + TS + Prettier) · Prettier (plugin Tailwind) · Husky (`pre-commit` lint-staged, `commit-msg` commitlint)
- [x] Vitest (3 fichiers, 9 tests) · Playwright (mobile + desktop, 8 tests, `CI=1` ⇒ `next start`)
- [x] CI GitHub Actions : quality (lint, types, format, unit) · build · e2e
- [x] `vercel.json` (framework nextjs, région `cdg1`) · projet Vercel lié au dépôt GitHub (previews)
- [ ] `supabase start` vérifié localement (Docker indisponible dans l'environnement de la session 1 ; à faire sur le poste du porteur)

## Session 2 — à faire

- [ ] Télécharger le logo officiel (`public/brand/`), extraire la palette, dériver les tokens Tailwind
- [ ] Si logo monochrome : proposer 2 palettes (bleu profond / or doux, bleu nuit / sable) et demander validation
- [ ] Typographies : Inter (UI) + serif discrète pour les titres (Fraunces ou Newsreader) — proposer, valider
- [ ] Page `/dev/ui` : tokens, composants, états, dark mode, contraste WCAG AA
- [ ] Icônes PWA 192/512, splash, favicon dérivés du logo (sans l'altérer)

## Questions ouvertes (§15 du brief)

Bloquantes pour la session 2 :

1. **Palette** : le logo est-il monochrome ? Si oui, choix entre bleu profond / or doux et bleu nuit / sable.
2. **Typographie des titres** : Fraunces ou Newsreader (Inter pour l'UI dans les deux cas).

Non bloquantes avant la session 3 (à trancher pour les sessions 3–10) :

3. Nom définitif et domaine (`kesher-abravanel.fr` ? sous-domaine de institutions-abravanel.fr ?).
4. Educartable : simple lien profond (aucune API publique connue) — hypothèse retenue.
5. Évaluations : compétences uniquement en maternelle ; notes chiffrées optionnelles en élémentaire ?
6. Groupes de classe : enseignant présent par défaut ou « parents seuls » avec parent délégué ?
7. Petites annonces / marketplace : autorisées par la direction ?
8. SMS (Twilio) pour urgences : budget accepté ?
9. Fournisseur e-mail : Resend (UE) ou domaine e-mail de l'école (SPF/DKIM) ?
10. Levallois : échéance d'activation ?
11. **Supabase cloud** : créer `kesher-staging` (région UE, coût mensuel selon plan) — nécessaire à partir de la session 3–4 pour les previews connectées.
