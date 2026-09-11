---
title: L'année scolaire et la promotion de niveau
roles: [staff, school_admin, super_admin]
routes: [/admin/annees, /admin/annees/promotion]
topic: manage
keywords: [année scolaire, courante, promotion, passage, niveau suivant, clôture, archive, rentrée]
since: 15
reviewed: 2026-09-11
---

Une école a **une seule année courante** : c'est elle qui porte les classes, les inscriptions et les périodes d'évaluation. Le libellé suit la forme `AAAA-AAAA`.

:::roles school_admin, super_admin
**La promotion de niveau** fait la bascule de fin d'année, en une seule opération :

1. créez d'abord l'année suivante dans la liste des années ;
2. ouvrez l'assistant, vérifiez classe par classe le niveau cible et le nom de la nouvelle classe, ou marquez une classe « quitte l'école » pour une fin de cursus ;
3. cochez la confirmation, puis lancez.

L'assistant crée les nouvelles classes, y inscrit les élèves, et rend l'année passée consultable en lecture seule. **Les enseignants ne sont pas recopiés** : affectez-les ensuite depuis Classes.

Tout se fait en une seule transaction : si quelque chose échoue, rien n'est appliqué. Le compte rendu chiffre les classes créées, les élèves inscrits et les élèves sortis.
:::
