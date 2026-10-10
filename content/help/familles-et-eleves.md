---
title: Gérer les familles, les élèves et les responsables
roles: [staff, school_admin, super_admin]
routes: [/admin/familles, /admin/familles/[studentId]]
topic: manage
keywords: [élève, famille, responsable, inscription, classe, allergies, PAI, restriction judiciaire, droits, mot de passe provisoire]
since: 5
reviewed: 2026-10-08
---

Gestion → **Familles** cherche un élève ou un parent par nom, prénom ou classe, et ouvre sa fiche.

:::roles school_admin, super_admin
Une famille entière — parents et enfants — s'inscrit d'un coup avec **Nouvelle famille**, en haut de la page : voir l'article « Inscrire une famille ».
:::

Sur la fiche d'un élève :

- état civil, date de naissance, **allergies / PAI**, statut (scolarisé, parti, archivé) ;
- **inscription en classe** : inscrire ou changer de classe clôt automatiquement l'inscription précédente — un élève n'a jamais deux inscriptions ouvertes, la base le garantit ;
- **responsables** rattachés, avec leur lien de parenté et le responsable principal.

Chaque responsable a ses **droits propres**, indépendants de ceux de l'autre parent : voir les évaluations, écrire à l'équipe, recevoir les notifications. Une famille séparée se gère ainsi sans que l'un décide pour l'autre.

**La restriction judiciaire** masque totalement l'enfant à un responsable : il disparaît de ses écrans, et il ne peut plus être désigné comme venant récupérer l'enfant au pointage. Le motif est obligatoire et l'action est journalisée. C'est une mesure lourde, appliquée par la base et non par l'écran.

Rattacher un responsable accepte un compte existant ou en crée un. Un compte créé reçoit un **mot de passe provisoire**, affiché une seule fois : transmettez-le au responsable, qui en choisira un autre à sa première connexion.

:::roles school_admin, super_admin
À côté de chaque responsable, **Mot de passe provisoire** remplace un mot de passe oublié par un nouveau, affiché une fois ; l'ancien cesse aussitôt de fonctionner. Il ne s'applique pas à un membre de la direction, ni à quelqu'un qui appartient aussi à une autre école : c'est alors l'administrateur de la plateforme qui s'en charge.
:::
