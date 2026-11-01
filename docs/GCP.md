# Google Cloud pour « S'entraîner » — marche à suivre

Les feuilles d'entraînement (ADR-0087) sont préparées par trois modèles de Google, appelés
dans la **multi-région UE** de Vertex AI (`eu`, point d'accès `aiplatform.eu.rep.googleapis.com`) :

| Rôle                    | Modèle (défaut)          | Variable pour le changer |
| ----------------------- | ------------------------ | ------------------------ |
| Écrire les exercices    | `gemini-3.8-flash`       | `PRACTICE_TEXT_MODEL`    |
| Dessiner l'illustration | `gemini-3.1-flash-image` | `PRACTICE_IMAGE_MODEL`   |
| Lire à voix haute       | `gemini-3.8-flash-tts`   | `PRACTICE_TTS_MODEL`     |

Les trois étaient listés à `eu` dans la documentation Google du 30 octobre 2026. L'hébreu
(`he-IL`) est en « Preview » pour la voix, d'où l'étiquette bêta de l'application.

Comptez **une vingtaine de minutes**. Rien de ce qui suit ne demande de toucher au code.

---

## 1. Ouvrir Google Cloud et la facturation

1. Aller sur <https://console.cloud.google.com> avec votre compte Google, accepter les
   conditions.
2. **Facturation** → créer un compte de facturation (carte bancaire). Un nouveau compte reçoit
   en général un crédit d'essai ; il sera consommé avant que la carte ne le soit.

## 2. Créer le projet

1. En haut de la console, sélecteur de projet → **Nouveau projet**.
2. Nom : `Kesher`. Notez l'**ID du projet** que Google propose dessous (par exemple
   `kesher-ecole-123456`) : c'est lui qui servira, pas le nom.
3. Vérifier que le projet est rattaché au compte de facturation (**Facturation** → « Associer
   un compte de facturation »).

## 3. Activer l'API

**API et services** → **Bibliothèque** → chercher **Vertex AI API** → **Activer**.

Ou, dans Cloud Shell (l'icône `>_` en haut à droite de la console) :

```bash
gcloud services enable aiplatform.googleapis.com --project=VOTRE-ID-DE-PROJET
```

## 4. Créer le compte de service et sa clé

Kesher ne se connecte pas avec votre compte personnel, mais avec un **compte de service** qui
n'a qu'un seul droit : appeler les modèles.

1. **IAM et administration** → **Comptes de service** → **Créer un compte de service**.
2. Nom : `kesher-practice`. **Créer et continuer**.
3. Rôle : **Vertex AI User** (`roles/aiplatform.user`). Rien d'autre. **OK**.
4. Ouvrir le compte créé → onglet **Clés** → **Ajouter une clé** → **Créer une clé** → **JSON**.
   Un fichier `.json` est téléchargé : c'est un secret, il ne doit aller que dans Vercel.

## 5. Mettre un budget (fortement conseillé)

**Facturation** → **Budgets et alertes** → **Créer un budget** : par exemple 20 € par mois sur
le projet `Kesher`, alertes à 50 %, 90 % et 100 % par e-mail.

Un budget **prévient**, il ne coupe pas. L'application plafonne de son côté : 20 feuilles par
personne et 300 par école sur 24 heures, et une feuille n'est préparée qu'une fois par devoir
et par niveau, pour toute la classe.

Chaque appel porte les étiquettes `app=kesher` et `feature=practice` : dans **Facturation** →
**Rapports**, on peut filtrer sur elles pour voir ce que coûte la fonction.

## 6. Donner la clé à Vercel

1. Encoder la clé sur une seule ligne, dans un terminal :
   - Mac : `base64 -i chemin/vers/la-cle.json | tr -d '\n' | pbcopy` (le résultat est copié)
   - Linux : `base64 -w0 chemin/vers/la-cle.json`
2. Vercel → projet `abracom` → **Settings** → **Environment Variables**, pour **Production**
   et **Preview** :

   | Nom                          | Valeur                       |
   | ---------------------------- | ---------------------------- |
   | `GOOGLE_CLOUD_PROJECT`       | l'ID du projet (étape 2)     |
   | `GOOGLE_CLOUD_LOCATION`      | `eu` — **jamais `global`**   |
   | `GOOGLE_SERVICE_ACCOUNT_KEY` | la ligne base64 de l'étape 1 |

   `global` laisserait Google traiter les demandes n'importe où dans le monde ; l'application
   refuse de démarrer la fonction avec cette valeur.

3. **Redéployer** (Deployments → les trois points du dernier → Redeploy) : les variables ne
   s'appliquent qu'aux nouveaux déploiements.
4. Supprimer le fichier `.json` de votre ordinateur. Si la clé fuit un jour : Comptes de
   service → Clés → la supprimer, en créer une autre, mettre à jour Vercel.

## 7. La base de données

La migration `20261101120000_practice_sheets.sql` part toute seule avec le workflow
« Deploy database » quand la branche est fusionnée dans `main`. Avant cela, le bloc
S'entraîner ne s'affiche pas — l'application le sait et ne plante pas.

## 8. Essayer

Se connecter en parent (ou dans l'école test), ouvrir un devoir, **S'entraîner** → **Pareil**.
La page montre les étapes ; la feuille arrive en une demi-minute environ.

Si la page dit « La feuille n'a pas pu être préparée », les journaux Vercel (Logs, filtre
`[practice]`) disent pourquoi :

| Message                                       | Ce qu'il faut faire                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `PERMISSION_DENIED` / 403                     | Le rôle **Vertex AI User** manque au compte de service (étape 4)                     |
| `SERVICE_DISABLED`                            | L'API n'est pas activée (étape 3)                                                    |
| `NOT_FOUND` / 404 sur un modèle               | Ce modèle n'est pas (ou plus) servi à `eu` : choisir un autre via `PRACTICE_*_MODEL` |
| `RESOURCE_EXHAUSTED` / 429                    | Quota du projet : **IAM et administration** → **Quotas**, demander une hausse        |
| `vertex: GOOGLE_CLOUD_PROJECT or key missing` | Une variable manque ou n'est pas dans l'environnement du déploiement                 |

Sans illustration ni voix mais avec les exercices : le modèle d'image ou de voix a échoué, la
feuille est publiée quand même (l'avertissement est dans les journaux).

## 9. Pour aller plus loin (facultatif)

- **Rien de personnel n'est envoyé** : le devoir et ses pages, jamais un nom d'enfant ni de
  famille (`docs/RGPD.md`). Google ne s'entraîne pas sur les données des clients de Vertex AI.
  Vertex AI garde par défaut les entrées en mémoire jusqu'à 24 h pour accélérer les appels ;
  la page Google « Vertex AI and zero data retention » explique comment le désactiver pour le
  projet, si la direction le souhaite.
- **Couper la fonction** sans rien supprimer : `PRACTICE_AI_PROVIDER=off` dans Vercel, puis
  redéployer. Pour une seule école : `modules.practice = false` sur l'école. Pour une classe :
  « Fermer pour la classe », depuis la fiche d'un devoir.
- **Développer sans clé** : `PRACTICE_AI_PROVIDER=fake` dans `.env.local` sert une feuille fixe,
  sans appel réseau (c'est aussi ce que joue la suite e2e).
