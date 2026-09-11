---
title: Le pointage — périscolaire, cantine, sorties
roles: all
routes: [/pointage, /pointage/[sessionId]]
topic: daily
keywords: [pointage, présence, appel, périscolaire, cantine, sortie, qui récupère, départ, arrivée]
since: 19
reviewed: 2026-09-12
---

Le pointage constate une présence : une arrivée, un départ, et qui récupère l'enfant. Il ne sert ni à la facturation ni à la tarification.

:::roles parent, guardian
Vous voyez les arrivées et les départs de votre enfant **au périscolaire et en sortie**, quand l'école a rendu la liste visible aux familles. L'appel de classe reste interne à l'équipe : la présence en classe suivie en direct serait de la surveillance, pas de l'information.
:::

:::roles teacher, staff, school_admin, super_admin
La page « Pointage » montre ce qu'il y a à pointer aujourd'hui, puis les autres listes. Une liste récurrente n'apparaît que les jours où elle est prévue.

Pointer, c'est une tape par enfant sur une grille de grandes vignettes. « Qui manque ? » filtre sur ceux qui ne sont pas encore pointés. Les enfants que leur famille a **annoncés absents** sont signalés, pour que vous ne les cherchiez pas — le pointage ne crée jamais d'absence à justifier à partir d'une saisie oubliée.

« Passer aux départs » bascule la grille en sortie. Sur une liste qui enregistre **qui récupère l'enfant**, l'application ne propose que les responsables autorisés de cet enfant ; une personne sous restriction judiciaire n'est jamais proposée et sa saisie est refusée par la base.

**Sans réseau, le pointage continue.** Les tapes sont mises en file dans le navigateur et rejouées dans l'ordre au retour de la connexion ; un compteur indique combien attendent. C'est l'heure de la tape qui fait foi, pas celle de l'envoi. Ne fermez pas l'onglet tant que le compteur n'est pas à zéro.

Un pointage se clôture, et se rouvre : une correction après coup reste possible et part dans le journal. La liste s'exporte en CSV. Les données sont conservées douze mois glissants.

Si aucune liste ne vous est confiée, la page le dit : c'est la direction qui accorde le pointage liste par liste.
:::
