# Recette (QA) sur le jeu de données fictif

Environnement : https://abracom.vercel.app (branche `claude/kesher-community-platform-2wxuya`), projet
Supabase « Kesher » (Paris). Connexion : page `/connexion` → « Se connecter avec un mot de passe ».
Le mot de passe des comptes `*@demo.local` est communiqué hors dépôt. Pas de double authentification ni
de confirmation par e-mail pendant cette phase (ADR-0030) ; les liens magiques par e-mail ne sont pas
utilisables avec l'expéditeur par défaut.

| Compte                     | Rôle                             | À quoi il sert                           |
| -------------------------- | -------------------------------- | ---------------------------------------- |
| `parent-1@demo.local`      | Parent de Maya (PS) et Noam (CP) | Parcours famille complet, deux enfants   |
| `parent-en@demo.local`     | Parent anglophone (famille 2)    | Interface en anglais                     |
| `parent-003-01@demo.local` | Parent séparé (famille 3, Talia) | Droits indépendants des deux parents     |
| `guardian-005@demo.local`  | Responsable en lecture seule     | Ni évaluations, ni messagerie, ni « vu » |
| `teacher-ps@demo.local`    | Enseignante PS Tournesols        | Publication, évaluations, RDV            |
| `staff@demo.local`         | Secrétariat                      | Familles, import, absences, modération   |
| `admin@demo.local`         | Direction                        | Tout, dont journal d'audit et promotion  |

Chaque ligne se coche quand le résultat attendu est observé ; noter l'écart sinon.

## Parent (`parent-1`)

- [ ] Accueil : annonce épinglée à confirmer → « J'ai lu » disparaît de la liste des accusés en attente
- [ ] Enfants : deux cartes (Maya, Noam) avec classe et enseignant·e ; Noam en CP
- [ ] Classe de Maya → Fil : billets de journal, devoirs, infos ; photos floutées pour les élèves sans droit
      à l'image ; devoir → « Vu » se coche et se décoche
- [ ] Classe → Mots : mot individuel avec accusé de lecture ; « Marquer comme lu »
- [ ] Classe → Absences : déclarer une absence avec justificatif PDF → statut « déclarée »
- [ ] Classe → Évaluations : période publiée visible, livret PDF téléchargeable
- [ ] Messagerie : groupe « Parents de la classe » PS, envoi d'un message, réaction, signalement
- [ ] Messagerie → Nouveau : l'enseignante de Maya est proposée, pas les autres parents
- [ ] Agenda : fêtes juives et horaires de Chabbat, réunion de rentrée → réponse RSVP, liste d'attente
      quand la jauge est atteinte, créneau de bénévolat, abonnement ICS (URL privée)
- [ ] Communauté : annuaire de classe (uniquement les familles ayant opté), petite annonce en attente
      de relecture après dépôt, formulaire de rentrée par enfant, export impossible (réservé à l'école)
- [ ] Notifications : liste, préférences (heures calmes, mode Chabbat) ; activation push si les clés VAPID
      sont en place
- [ ] Profil : langue, date hébraïque, téléphone ; Données : export JSON ; suppression de compte (ne pas
      valider avec ce compte)
- [ ] Recherche globale : « hallah » trouve l'événement de bénévolat, rien de l'école B (aucune)

## Parent anglophone (`parent-en`)

- [ ] Interface en anglais dès la connexion, libellés de niveau (« Nursery »), titres de fils traduits
- [ ] Bascule français / anglais depuis le menu Langue conservée après rechargement

## Parents séparés (`parent-003-01` / `parent-003-02`) et restriction judiciaire (famille 44)

- [ ] Chacun voit Talia, ses propres réponses (RSVP, signatures, RDV), pas celles de l'autre
- [ ] `parent-044-02@demo.local` (accès restreint) ne voit aucun enfant, aucune classe, aucun fil

## Responsable en lecture seule (`guardian-005`)

- [ ] Voit la classe et les annonces, aucun onglet Évaluations ni ligne Évaluations dans « Ma famille »,
      aucune case « Vu », pas de signature de document, pas de formulaire, pas de réservation de créneau
- [ ] **Aucune messagerie** : pas d'onglet Messages (l'agenda prend sa place), pas de bouton « Nouveau
      message », pas de « Discussion de la classe » ; `/messages` saisi à la main renvoie à l'accueil

## Enseignante (`teacher-ps`)

- [ ] Sur téléphone, la barre du bas porte **École** : annonces, documents, agenda, formulaires et
      communauté sont à un geste (ADR-0036) ; « Publier » reste dans la barre de bureau
- [ ] Accueil : classes et résumé de la semaine
- [ ] Publier : journal avec photos (attestation obligatoire), devoir avec échéance, brouillon, info « équipe »
- [ ] Identifier un élève sans droit à l'image → refus explicite
- [ ] Évaluations : matrice, appréciation, « Publier aux familles » → visible côté `parent-1`
- [ ] Mots : mot individuel à Maya → notification et accusé côté parent
- [ ] Absences : justifier / refuser une absence déclarée
- [ ] RDV : générer des créneaux, voir les réservations avec noms de famille
- [ ] Messagerie : canal officiel (lecture seule pour les parents), groupe de parents, modération d'un
      message (motif) → visible dans les signalements de la direction
- [ ] Agenda : créer un événement de classe ; impossible de cibler une autre classe

## Secrétariat (`staff`)

- [ ] Familles : recherche, fiche élève, ajout d'un responsable (invitation), droits du responsable ;
      la restriction judiciaire est réservée à la direction (erreur attendue)
- [ ] Import CSV et Journal d'audit **absents de sa barre d'administration** : réservés à la direction
      (ADR-0035). Dix rubriques sur douze
- [ ] Absences : dans l'espace d'une classe, enregistrer l'absence qu'une famille signale au téléphone
- [ ] Annonces : rédaction, ciblage par niveau, planification, relance des non-lecteurs, export CSV
- [ ] Documents : dépôt d'une circulaire à signer, suivi des signatures manquantes
- [ ] Aucun accès aux évaluations, **et aucun onglet Évaluations** dans l'espace de classe ; modération
      des petites annonces ; résolution des signalements

## Direction (`admin`)

- [ ] Tout ce qui précède, plus : utilisateurs (suspendre / réactiver / retirer), classes et affectations
      (un enseignant encore invité peut être affecté), années scolaires, journal d'audit alimenté par les
      actions ci-dessus, promotion de niveau (assistant, ne pas valider sur la base de démo partagée)
- [ ] Droit à l'image : enregistrer une autorisation papier, la retirer → l'élève disparaît des photos
      identifiées
- [ ] Sécurité : inscription TOTP facultative ; une fois inscrit, le code est demandé à chaque session

## Transverses

- [ ] Mobile : cibles tactiles ≥ 44 px (dont les 24 cases de `/notifications/preferences`), navigation
      basse dont aucun libellé ne passe à la ligne, bannière d'installation PWA, page hors ligne
- [ ] Chaque écran vide dit ce qui le remplira, et propose l'action quand le rôle en a une
- [ ] Invitation → 1re connexion : le lien reçu par e-mail ouvre `/bienvenue` dans **n'importe quel**
      navigateur, pas seulement celui qui a envoyé l'invitation (couvert par `tests/e2e/auth-invitation`)
- [ ] Mode sombre, contraste, navigation clavier, lien d'évitement
- [ ] Aide : guides parents / enseignants / direction lisibles et exportables en PDF
- [ ] Aucune trace technique dans les messages d'erreur ; aucune donnée d'un autre établissement

## Hors périmètre de cette recette

E-mails (Resend non branché), push (clés VAPID à renseigner), SMS, cantine, facturation.
