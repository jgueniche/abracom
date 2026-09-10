# Kesher — protection des données (RGPD)

> Document de travail à valider par la direction et, le cas échéant, le DPO de l'établissement.
> L'école est **responsable de traitement** ; le porteur du projet (parent bénévole) agit comme
> prestataire technique. Les données concernent des **mineurs** : minimisation et opt-in partout.

## 1. Registre des traitements

| Traitement               | Finalité                                                             | Base légale                                  | Données                                                               | Accès                                                                                             |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Comptes et rôles         | Authentifier les parents, enseignants et l'équipe                    | Exécution du contrat de scolarité            | e-mail, nom, téléphone, langue, rôles, acceptation des CGU            | Personne concernée, direction                                                                     |
| Dossier élève            | Rattacher les enfants aux responsables et aux classes                | Contrat de scolarité, intérêt légitime       | identité, date de naissance, classe, allergies / PAI, droits          | Responsables, équipe de la classe, direction                                                      |
| Communication officielle | Annonces, documents, signatures, accusés de lecture                  | Intérêt légitime (fonctionnement de l'école) | lectures, signatures (horodatage, IP, navigateur)                     | Direction, personne concernée                                                                     |
| Espace classe            | Devoirs, cahier de vie, mots, absences, évaluations                  | Contrat de scolarité                         | publications, photos (droit à l'image signé), évaluations             | Familles de la classe, équipe                                                                     |
| Messagerie               | Échanges parents ↔ enseignants / direction, modération               | Intérêt légitime                             | messages, pièces jointes, signalements                                | Membres du fil, modérateurs                                                                       |
| Agenda et communauté     | Événements, RSVP, bénévolat, annuaire opt-in, annonces               | Consentement (opt-in) / intérêt légitime     | réponses, inscriptions, coordonnées partagées, petites annonces       | Membres de l'école selon l'opt-in                                                                 |
| Notifications            | Push, e-mail, résumé quotidien                                       | Intérêt légitime, préférences                | abonnements push, préférences, historique de livraison                | Personne concernée                                                                                |
| Présence (pointage)      | Constater la présence, l'arrivée, le départ et qui récupère l'enfant | Contrat de scolarité, sécurité des mineurs   | listes, occurrences datées, statut, heures, responsable qui récupère  | Équipe désignée liste par liste, direction ; la famille pour son enfant (périscolaire et sorties) |
| Journal d'audit          | Traçabilité des actions d'administration et de modération            | Obligation de sécurité (art. 32)             | acteur, action, entité, horodatage                                    | Direction                                                                                         |
| Observabilité            | Détection des erreurs                                                | Intérêt légitime                             | traces techniques sans données personnelles (`sendDefaultPii: false`) | Prestataire technique                                                                             |

## 2. Sous-traitants et hébergement (Union européenne uniquement)

| Prestataire | Rôle                                                    | Région                  |
| ----------- | ------------------------------------------------------- | ----------------------- |
| Supabase    | Base de données, authentification, stockage, temps réel | `eu-west-3` (Paris)     |
| Vercel      | Hébergement de l'application                            | `cdg1` (Paris)          |
| Resend      | E-mails transactionnels                                 | Région UE du workspace  |
| Sentry      | Suivi des erreurs (optionnel)                           | Région UE (`ingest.de`) |

Aucun traceur tiers, aucune analyse d'audience externe. Les polices sont auto-hébergées.

## 3. Durées de conservation (appliquées par `purge_expired_data()`, chaque nuit)

| Donnée                                                 | Durée                                                                                    | Mécanisme                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Dossier élève (identité, date de naissance, allergies) | Année scolaire en cours + 1 an après le départ                                           | Anonymisation le 1er août suivant l'année scolaire qui suit le départ |
| Photos où l'élève est identifié                        | Jusqu'au départ de l'élève                                                               | Suppression des médias tagués dès que l'élève a quitté l'école        |
| Messages et pièces jointes                             | 2 ans                                                                                    | Suppression                                                           |
| Notifications                                          | 6 mois (historique de livraison : 30 jours)                                              | Suppression                                                           |
| Petites annonces retirées / refusées                   | 90 jours                                                                                 | Suppression                                                           |
| Pointages (présence, arrivée, départ, récupération)    | 12 mois glissants                                                                        | Suppression des occurrences (les pointages suivent en cascade)        |
| Journal d'audit                                        | 3 ans                                                                                    | Suppression                                                           |
| Signatures électroniques                               | Durée de scolarité + 1 an (valeur probante)                                              | Suivent le dossier élève                                              |
| Compte utilisateur                                     | Jusqu'à la demande de suppression ou 1 an d'inactivité après le départ du dernier enfant | Anonymisation (`delete_my_account`)                                   |

Les objets du stockage (photos, justificatifs, pièces jointes) référencés par des lignes supprimées
sont retirés par un balayage mensuel du bucket (script d'exploitation, session 15).

## 4. Exercice des droits

- **Accès et portabilité** : `/profil/donnees` → « Exporter mes données » (JSON complet, calculé sous
  RLS, donc limité à ce que la personne voit elle-même).
- **Rectification** : profil modifiable par la personne ; dossier élève par le secrétariat.
- **Effacement** : `/profil/donnees` → suppression en libre-service (anonymisation immédiate, compte
  d'authentification supprimé). Le dernier administrateur d'une école doit d'abord transférer son rôle.
  Les demandes concernant un élève passent par la direction (`/admin/familles`).
- **Opposition et limitation** : préférences de notification, opt-in annuaire / anniversaires,
  droit à l'image par document signé (révocable auprès du secrétariat).
- Délai de réponse : un mois (art. 12). Contact : secrétariat de l'école, qui relaie au prestataire.

## 5. Mesures de sécurité (art. 32)

- Isolation par établissement (`school_id` partout) et **RLS sur toutes les tables**, testée (pgTAP).
- Accès par lien magique uniquement, invitations par la direction, aucune inscription libre.
- **Validation en deux étapes obligatoire pour la direction** (TOTP), disponible pour tous.
- Buckets privés, URL signées 10 minutes, photos normalisées sans métadonnées EXIF.
- CSP stricte à nonce, HSTS, `frame-ancestors 'none'`, cookies de session `httpOnly`.
- Journal d'audit sur toute action d'administration, de modération et de sécurité.
- Sauvegardes quotidiennes Supabase (PITR selon le plan), secrets dans Vault / variables Vercel.
- Familles séparées : droits indépendants par responsable, indicateur de restriction judiciaire.
- **Pointage** : la personne qui récupère un enfant ne peut être qu'un responsable autorisé de cet
  enfant ; un responsable sous restriction judiciaire n'est jamais proposé et est refusé en base
  (déclencheur `attendance_pickup_guard`, vérifié par pgTAP). Le droit de pointer est accordé liste
  par liste, et toute correction d'un pointage clôturé part dans le journal d'audit.
- L'appel de classe n'est pas visible des familles : seuls le périscolaire et les sorties le sont
  (ADR-0039), pour ne pas transformer la journée de classe en surveillance.

## 6. Violation de données

Détection (Sentry, journal), qualification, notification à la CNIL sous 72 h si risque, information
des personnes si risque élevé. Registre des incidents tenu par la direction.
