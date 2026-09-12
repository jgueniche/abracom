---
title: Sécuriser son compte, la validation en deux étapes
roles: all
routes: [/profil/securite, /verification]
topic: data
keywords: [sécurité, 2FA, double authentification, TOTP, code, application d'authentification, mot de passe]
since: 14
reviewed: 2026-09-12
---

Mon profil → **Sécurité** porte le mot de passe et la validation en deux étapes.

La **validation en deux étapes** ajoute un code à six chiffres, changé toutes les trente secondes, en plus du mot de passe. L'activation se fait avec une application d'authentification sur votre téléphone : scannez le code affiché, puis saisissez un premier code pour confirmer. Sans cette confirmation, rien n'est activé — on ne se verrouille pas dehors par accident.

:::roles school_admin, super_admin
Elle peut être **obligatoire pour la direction** : l'école décide de l'exiger. Tant qu'elle n'est pas activée, les écrans de gestion redirigent vers cette page. À chaque nouvelle session, un code vous est demandé avant d'ouvrir la gestion.
:::

:::roles parent, guardian, teacher, staff
Elle est facultative pour votre rôle, et vivement recommandée : votre compte donne accès à des informations concernant des enfants.
:::

Gardez les codes de secours en lieu sûr : un téléphone perdu sans eux oblige l'école à réinitialiser votre accès.
