---
title: Inscrire une famille
roles: [school_admin, super_admin]
routes: [/admin/familles/nouvelle]
topic: manage
keywords: [inscription, nouvelle famille, parent, enfant, compte, mot de passe provisoire, identifiants, courriel d'inscription]
since: 34
reviewed: 2026-10-08
---

Les familles ne s'inscrivent pas elles-mêmes : elles écrivent à l'adresse indiquée sous « Pas de compte ? » de la page de connexion, en donnant le nom et le prénom de chaque parent, son adresse de courriel, et le nom, le prénom et la classe de chaque enfant. La direction saisit ce courriel une fois.

Gestion → Familles → **Nouvelle famille** :

- **un ou deux parents** — prénom, nom, adresse de courriel (c'est leur identifiant), téléphone s'il est donné, lien avec l'enfant, langue de l'application ;
- **un à huit enfants** — prénom, nom, date de naissance si elle est connue, et la classe. Une classe qui n'existe pas encore n'empêche rien : l'enfant est inscrit sans classe, et se place plus tard depuis sa fiche.

**Inscrire la famille** crée tout d'un bloc : chaque parent reçoit un compte, rattaché à chacun des enfants, et les enfants entrent dans leur classe. Si quelque chose est refusé, rien n'est créé à moitié.

L'écran affiche alors **les identifiants à transmettre** : pour chaque parent, son adresse et un **mot de passe provisoire**. Ils ne seront plus jamais affichés — « Copier le message » prend le texte prêt à envoyer par SMS ou courriel. À sa première connexion, chaque parent choisit son propre mot de passe avant d'ouvrir quoi que ce soit.

Un parent qui avait déjà un compte — une sœur aînée déjà inscrite, par exemple — est simplement rattaché aux nouveaux enfants : son mot de passe ne change pas.

**Un parent a oublié son mot de passe ?** Sur la fiche de l'enfant, à côté de son nom, **Mot de passe provisoire** lui en donne un nouveau, affiché une fois. L'ancien cesse aussitôt de fonctionner, et l'action est journalisée.
