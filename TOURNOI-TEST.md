# Créer un tournoi test – Guide complet

Ce guide regroupe tout ce dont tu as besoin pour créer et tester un tournoi dans l’app (soit via un tournoi démo en base, soit en le créant toi-même dans l’app).

---

## 1. Prérequis

- **Projet Supabase** : projet configuré et `supabaseUrl` / `supabaseAnonKey` renseignés dans l’app.
- **Compte admin** (pour créer un tournoi depuis l’app) : exécuter une fois le script `supabase-seed-default-admin.sql` (voir ci‑dessous). Sinon, un compte avec `role = 'admin'` dans la table `users` suffit.
- **Optionnel** : des **équipes** et un **lieu (venue)** en base pour pouvoir ajouter des matchs au tournoi démo et inscrire des équipes.

---

## 2. Scripts SQL à exécuter (Supabase)

Dans **Supabase Dashboard → SQL Editor**, exécuter les scripts **dans cet ordre** :

### Étape A – Migration des matchs (tournoi)

Fichier : **`supabase-migration-tournament-match-fields.sql`**

- Ajoute les colonnes `tournament_id` et `round_label` à la table `matches` si besoin.
- À exécuter une seule fois.

### Étape B – Visibilité des tournois (RLS)

Fichier : **`supabase-policy-tournaments-visible.sql`**

- Permet à tout le monde de **voir** les tournois dans l’app.
- Si tes tournois n’apparaissent pas dans l’onglet Tournois, exécute ce script.

### Étape C (optionnel) – Compte admin par défaut

Fichier : **`supabase-seed-default-admin.sql`**

- Crée ou met à jour un utilisateur admin (ex. téléphone +1 438 508 9540).
- À adapter selon ton système d’auth (Supabase Auth / custom). Sans ce script, il faut un utilisateur avec `role = 'admin'` pour voir le bouton « Créer un tournoi » et gérer les tournois.

### Étape D (optionnel) – Tournoi démo déjà en base

Fichier : **`supabase-seed-demo-tournament.sql`**

- Crée un tournoi **« Tournoi démo - Gestion »** en statut **En cours**, avec dates de début (aujourd’hui) et de fin (dans 7 jours).
- Si tu as des équipes et un lieu en base, le script peut créer 2 matchs démo et inscrire des équipes.
- Après exécution : ouvre l’app → **Tournois** → « Tournoi démo - Gestion » → **Déroulé du tournoi** pour tester matchs, classement, scores, vainqueur.

Résumé :

| Ordre | Fichier | Rôle |
|-------|---------|------|
| 1 | `supabase-migration-tournament-match-fields.sql` | Colonnes tournoi sur les matchs |
| 2 | `supabase-policy-tournaments-visible.sql` | RLS : tournois visibles |
| 3 | `supabase-seed-default-admin.sql` | (Optionnel) Compte admin |
| 4 | `supabase-seed-demo-tournament.sql` | (Optionnel) Tournoi démo + matchs |

---

## 3. Créer un tournoi test depuis l’app

Si tu ne veux pas utiliser le tournoi démo et préfères tout faire à la main :

1. **Te connecter** avec un compte **admin** (ou un utilisateur dont une équipe a au moins 5 membres et dont tu es capitaine).
2. Aller dans l’onglet **Tournois** (icône trophée).
3. Appuyer sur **« Créer un tournoi »** (bouton en haut ou dans l’état vide).
4. Remplir le formulaire :
   - **Nom** (ex. « Tournoi test janvier »)
   - **Description** (optionnel)
   - **Sport** (ex. Football)
   - **Format** (ex. 11v11)
   - **Type** (Élimination directe, Championnat, etc.)
   - **Niveau** (ex. Intermédiaire)
   - **Nombre max d’équipes** (ex. 8)
   - **Frais d’inscription** / **Dotation** (optionnel)
   - **Lieu** : choisir dans la liste ou saisir un lieu manuel (nom + ville). Les propositions (ex. Stade municipal, Stade FHB, etc.) sont là pour aller plus vite.
   - **Date de début** et **Date de fin** : utiliser le sélecteur de date (évite les décalages de fuseau).
5. Valider la création.

Ensuite :

- Le tournoi apparaît dans la liste (statut **Inscriptions**).
- En cliquant dessus : détail, participants, bouton **« Déroulé du tournoi »**.
- Une fois le statut passé en **En cours** (onglet Admin du déroulé, ou logique métier existante), tu peux **ajouter des matchs**, **saisir les scores**, **voir le classement**, **déclarer le vainqueur**.

---

## 4. Données utiles pour les tests

- **Équipes** : pour inscrire des équipes au tournoi et créer des matchs « Équipe A vs Équipe B », il faut des équipes créées dans l’app (et liées à des utilisateurs).
- **Lieux (venues)** : pour associer un lieu au tournoi et aux matchs. Soit tu en as déjà en base (table `venues`), soit tu utilises la saisie manuelle (nom + ville) à la création du tournoi.
- **Tournoi démo** : le script `supabase-seed-demo-tournament.sql` utilise les premières lignes de `teams` et `venues` s’ils existent ; sinon le tournoi est créé sans matchs et tu pourras en ajouter depuis l’app.

---

## 5. Checklist rapide

- [ ] Migration `supabase-migration-tournament-match-fields.sql` exécutée
- [ ] Policy `supabase-policy-tournaments-visible.sql` exécutée
- [ ] (Optionnel) Admin seed exécuté ou un user `role = 'admin'` existe
- [ ] (Optionnel) Seed tournoi démo exécuté
- [ ] App ouverte, onglet **Tournois** : au moins un tournoi visible (démo ou créé à la main)
- [ ] Clic sur un tournoi → **Déroulé du tournoi** → onglets Matchs / Classement / Résultats / Admin testés

Tu as tout pour créer un tournoi test et vérifier le déroulé (matchs, classement, résultats, admin).
