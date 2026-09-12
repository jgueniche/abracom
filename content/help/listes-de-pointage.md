---
title: Créer les listes de pointage et confier le pointage
roles: [school_admin, super_admin]
routes: [/admin/pointage]
topic: manage
keywords: [pointage, liste, périscolaire, cantine, appel, responsable, récurrence, visible, archiver]
since: 19
reviewed: 2026-09-12
---

Gestion → **Pointage** crée les listes et dit qui a le droit de pointer sur chacune.

Trois natures de liste, et le choix change les règles :

- **Appel d'une classe** — reste interne à l'équipe, une tape par enfant, sans désigner qui le récupère ;
- **Service récurrent** — périscolaire du matin, du soir, cantine : les familles le suivent, et le départ demande qui récupère l'enfant ;
- **Sortie** — sa liste se crée depuis l'événement lui-même, dans l'agenda, pour qu'elle hérite de ses participants.

La récurrence est simple : des jours de la semaine et une plage de dates. Une occurrence est créée le jour où l'on pointe. Un rattrapage hors récurrence reste possible, et il est daté.

**Qui peut pointer** se donne liste par liste. Ce n'est pas un rôle : ni le secrétariat ni les enseignants n'en héritent d'office — sauf l'appel de leur propre classe pour ces derniers. Une animatrice du soir reçoit ainsi le droit de pointer son service, et rien d'autre.

**Visible des familles** décide si les parents voient les arrivées et les départs. Laissez l'appel de classe invisible : la présence en classe suivie en direct relève de la surveillance, et transformerait chaque retard en notification.

Le **code de service** est facultatif et ne sert qu'à regrouper un service plus tard. Il n'y a ici ni tarif ni facturation.

Une liste qui ne sert plus s'archive. Les données de pointage sont purgées automatiquement après douze mois glissants.
