# 🚀 Guide de Déploiement Production - VS Sport Connect

**Date:** Mars 2026  
**Version:** 1.0.0  
**Objectif:** Déployer l'application VS Sport Connect en production (App Store, Google Play, Web)

---

## 📋 Vue d'ensemble

Ce guide vous accompagne étape par étape pour déployer l'application en production de manière sécurisée et performante.

### Durée estimée
- **Première fois:** 4-6 heures
- **Redéploiement:** 30-60 minutes

### Prérequis
- Compte Supabase actif avec projet configuré
- Compte EAS (Expo Application Services)
- Accès au dashboard Supabase
- Node.js et npm/bun installés localement

---

## 🎯 Étape 1 : Appliquer la Migration SQL

### 1.1 Vérifier l'état actuel de la base de données

Connectez-vous au **Dashboard Supabase** → **SQL Editor** et exécutez :

```sql
-- Vérifier les contraintes existantes
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid IN ('matches'::regclass, 'users'::regclass);

-- Vérifier les politiques RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('notifications', 'users', 'matches');
```

### 1.2 Nettoyer les données invalides (si nécessaire)

**⚠️ IMPORTANT:** Si votre base contient déjà des données, nettoyez les valeurs invalides avant d'appliquer les contraintes :

```sql
-- Nettoyer les données invalides
UPDATE matches SET entry_fee = 0 WHERE entry_fee < 0;
UPDATE matches SET max_players = 2 WHERE max_players < 2;
UPDATE matches SET prize = 0 WHERE prize < 0;
UPDATE users SET bio = '' WHERE bio IS NULL;

-- Vérifier qu'il n'y a plus de données invalides
SELECT COUNT(*) FROM matches WHERE entry_fee < 0 OR max_players < 2 OR prize < 0;
```

### 1.3 Appliquer la migration de production

Dans **Supabase Dashboard** → **SQL Editor**, copiez et exécutez le contenu du fichier :

```
supabase/migrations/20260302_production_fixes.sql
```

**Ce que cette migration fait :**
- ✅ Ajoute des contraintes de validation sur `matches` (entry_fee, max_players, prize)
- ✅ Valide la structure JSONB des stats utilisateurs (10 champs requis)
- ✅ Configure les politiques RLS pour `notifications`
- ✅ Crée un trigger pour initialiser automatiquement les stats
- ✅ Permet les bio vides
- ✅ Ajoute des index pour améliorer les performances

### 1.4 Vérifier que la migration a réussi

```sql
-- Vérifier les contraintes
SELECT conname FROM pg_constraint 
WHERE conname IN ('matches_entry_fee_check', 'matches_max_players_check', 'matches_prize_check', 'users_stats_check');

-- Vérifier les politiques RLS
SELECT policyname FROM pg_policies WHERE tablename = 'notifications';

-- Vérifier les index
SELECT indexname FROM pg_indexes 
WHERE indexname IN ('idx_matches_venue_id', 'idx_matches_created_by', 'idx_notifications_user_id', 'idx_notifications_read');
```

**Résultat attendu :** Toutes les contraintes, politiques et index doivent être listés.

---

## 🔐 Étape 2 : Configurer les Variables d'Environnement

### 2.1 Variables Backend (Serveur)

Sur votre plateforme d'hébergement (Railway, Render, Fly.io, VPS), configurez :

```bash
# Obligatoire
SUPABASE_URL=https://vzycjpbrwwpvnypwzfrw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<votre_service_role_key>

# Recommandé
ALLOWED_ORIGINS=https://rork.com,https://app.rork.com
PORT=3000

# Optionnel
RESEND_API_KEY=<votre_resend_api_key>
```

**⚠️ SÉCURITÉ:** Ne jamais committer `SUPABASE_SERVICE_ROLE_KEY` dans le code !

### 2.2 Obtenir la Service Role Key

1. **Supabase Dashboard** → **Settings** → **API**
2. Copier la clé **service_role** (section "Project API keys")
3. ⚠️ Cette clé donne un accès complet à la base - à garder secrète

### 2.3 Variables App Mobile (EAS)

Les variables sont déjà configurées dans `eas.json` pour le profil production :

```json
{
  "production": {
    "env": {
      "EXPO_PUBLIC_USE_BACKEND_AUTH": "true",
      "EXPO_PUBLIC_RORK_API_BASE_URL": "https://api.rork.com",
      "EXPO_PUBLIC_SUPABASE_URL": "https://vzycjpbrwwpvnypwzfrw.supabase.co",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**À modifier :**
- `EXPO_PUBLIC_RORK_API_BASE_URL` → Remplacer par l'URL de votre backend déployé

### 2.4 (Optionnel) Utiliser EAS Secrets pour plus de sécurité

Pour éviter d'exposer les clés dans `eas.json` :

```bash
# Installer EAS CLI
npm install -g @expo/eas-cli

# Se connecter
eas login

# Créer des secrets
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "votre_cle"
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "votre_dsn"
```

---

## 🖥️ Étape 3 : Déployer le Backend

### 3.1 Choisir une plateforme

| Plateforme | Difficulté | Coût | Recommandation |
|------------|------------|------|----------------|
| **Railway** | ⭐ Facile | Gratuit/5$/mois | ✅ Recommandé pour débuter |
| **Render** | ⭐ Facile | Gratuit/7$/mois | ✅ Bonne alternative |
| **Fly.io** | ⭐⭐ Moyen | Gratuit/Variable | Pour utilisateurs avancés |
| **VPS** | ⭐⭐⭐ Difficile | 5-20$/mois | Maximum de contrôle |

### 3.2 Déploiement sur Railway (Recommandé)

#### A. Créer le projet

1. Aller sur [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Sélectionner votre dépôt `rork-versus-sport-connect`
4. Railway détecte automatiquement Node.js

#### B. Configurer les variables

**Settings** → **Variables** → Ajouter :

```
SUPABASE_URL=https://vzycjpbrwwpvnypwzfrw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<votre_service_role_key>
ALLOWED_ORIGINS=https://rork.com
PORT=3000
```

#### C. Configurer le build

**Settings** → **Build & Deploy** :

- **Build Command:** `npm install`
- **Start Command:** `npm run backend`
- **Watch Paths:** `backend/**` (optionnel - redéploie uniquement si le backend change)

#### D. Déployer

Railway déploie automatiquement. Vous obtenez une URL comme :
```
https://rork-versus-sport-connect-production.up.railway.app
```

#### E. Ajouter un domaine personnalisé (Optionnel)

**Settings** → **Domains** → **Custom Domain** → Ajouter `api.rork.com`

Configurer le DNS :
```
Type: CNAME
Name: api
Value: <votre-url-railway>.up.railway.app
```

### 3.3 Vérifier le déploiement

```bash
# Test de santé
curl https://votre-url-backend.up.railway.app/

# Résultat attendu
{"status":"ok","message":"API is running"}

# Test de login (remplacer par vos données de test)
curl -X POST https://votre-url-backend.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","password":"test123"}'
```

### 3.4 Mettre à jour l'URL dans l'app

Dans `eas.json`, modifier le profil production :

```json
"production": {
  "env": {
    "EXPO_PUBLIC_RORK_API_BASE_URL": "https://votre-url-backend.up.railway.app"
  }
}
```

---

## 📱 Étape 4 : Configurer Sentry (Crash Reporting)

### 4.1 Créer un projet Sentry

1. Aller sur [sentry.io](https://sentry.io)
2. **Create Project** → **React Native**
3. Copier le **DSN** (ex: `https://xxx@xxx.ingest.sentry.io/xxx`)

### 4.2 Ajouter le DSN

**Option A - Dans eas.json :**

```json
"production": {
  "env": {
    "EXPO_PUBLIC_SENTRY_DSN": "https://xxx@xxx.ingest.sentry.io/xxx"
  }
}
```

**Option B - Via EAS Secrets (recommandé) :**

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://xxx@xxx.ingest.sentry.io/xxx"
```

### 4.3 Tester Sentry

L'app est déjà configurée pour envoyer les erreurs à Sentry. Après le build, testez en déclenchant une erreur volontaire.

---

## 🔒 Étape 5 : Sécuriser avec RLS (Optionnel - Avancé)

**⚠️ ATTENTION:** Cette étape est optionnelle et nécessite une migration d'authentification.

### État actuel
- L'app utilise une authentification custom (téléphone + mot de passe)
- Les politiques RLS sont permissives (`USING (true)`)
- L'app communique avec Supabase via la clé `anon`

### Option A : Tout passer par le backend (Recommandé)

1. Migrer toutes les écritures vers le backend
2. L'app n'utilise Supabase qu'en lecture
3. Appliquer des politiques RLS restrictives en lecture seule

### Option B : Migrer vers Supabase Auth

1. Remplacer l'auth custom par Supabase Auth (magic link, OTP)
2. Utiliser `auth.uid()` dans les politiques RLS
3. Appliquer le fichier `supabase-rls-production.sql`

**Pour l'instant, ne pas appliquer de RLS restrictives** - l'app actuelle casserait.

---

## 🏗️ Étape 6 : Builder l'Application

### 6.1 Installer EAS CLI

```bash
npm install -g @expo/eas-cli
eas login
```

### 6.2 Configurer EAS

```bash
eas build:configure
```

### 6.3 Build iOS (Production)

```bash
eas build --platform ios --profile production
```

**Prérequis :**
- Compte Apple Developer (99$/an)
- Certificats et profils de provisioning (EAS les gère automatiquement)

### 6.4 Build Android (Production)

```bash
eas build --platform android --profile production
```

**Prérequis :**
- Compte Google Play Developer (25$ unique)
- Keystore (EAS le crée automatiquement)

### 6.5 Suivre le build

Les builds s'exécutent sur les serveurs EAS. Suivez la progression :
- Dans le terminal
- Sur [expo.dev/accounts/[votre-compte]/projects](https://expo.dev)

**Durée :** 10-20 minutes par plateforme

---

## 📤 Étape 7 : Soumettre aux Stores

### 7.1 App Store (iOS)

```bash
eas submit --platform ios
```

**Informations requises :**
- Apple ID
- App-specific password
- Bundle identifier (défini dans `app.json`)

**Processus de review :** 1-3 jours

### 7.2 Google Play (Android)

```bash
eas submit --platform android
```

**Informations requises :**
- Compte Google Play Developer
- Service account JSON key

**Processus de review :** Quelques heures à 1 jour

### 7.3 Pages légales (Obligatoire pour les stores)

Les pages Terms et Privacy doivent être accessibles en ligne :

1. Déployer le dossier `legal-pages/` sur un hébergement web
2. Les URLs sont déjà configurées dans `app.json` :
   - Privacy: `https://rork.com/privacy`
   - Terms: `https://rork.com/terms`

**Options de déploiement :**
- Vercel (gratuit)
- Netlify (gratuit)
- GitHub Pages (gratuit)

**Commande rapide (Vercel) :**

```bash
cd legal-pages
npx vercel --prod
```

---

## ✅ Étape 8 : Vérifications Finales

### 8.1 Checklist Technique

- [ ] Migration SQL appliquée et vérifiée
- [ ] Backend déployé et accessible
- [ ] Variables d'environnement configurées
- [ ] Sentry configuré et testé
- [ ] Build iOS réussi
- [ ] Build Android réussi
- [ ] Pages légales déployées

### 8.2 Checklist Fonctionnelle

- [ ] Inscription d'un nouvel utilisateur
- [ ] Connexion avec téléphone + mot de passe
- [ ] Création d'une équipe
- [ ] Création d'un match
- [ ] Rejoindre un match
- [ ] Notifications push
- [ ] Géolocalisation des terrains
- [ ] Panneau admin (compte admin)

### 8.3 Tests de Performance

```bash
# Lancer les tests E2E
npm run test:e2e

# Résultat attendu : 164/168 tests passent (98%)
```

### 8.4 Monitoring Post-Déploiement

**À surveiller les 48 premières heures :**
- Taux de crash (Sentry)
- Temps de réponse API (backend logs)
- Erreurs SQL (Supabase logs)
- Feedback utilisateurs

---

## 🐛 Troubleshooting

### Problème : Migration SQL échoue

**Erreur :** `constraint violation`

**Solution :**
```sql
-- Identifier les données problématiques
SELECT * FROM matches WHERE entry_fee < 0 OR max_players < 2 OR prize < 0;

-- Corriger manuellement
UPDATE matches SET entry_fee = 0 WHERE entry_fee < 0;
```

### Problème : Backend ne démarre pas

**Erreur :** `SUPABASE_SERVICE_ROLE_KEY is not defined`

**Solution :**
- Vérifier que la variable est bien définie sur la plateforme
- Redémarrer le service après ajout de variables

### Problème : App ne se connecte pas au backend

**Erreur :** `Network request failed`

**Solution :**
- Vérifier que `EXPO_PUBLIC_RORK_API_BASE_URL` est correct
- Tester l'URL backend avec `curl`
- Vérifier CORS (`ALLOWED_ORIGINS`)

### Problème : Build EAS échoue

**Erreur :** `Build failed`

**Solution :**
```bash
# Nettoyer le cache
npx expo start --clear

# Vérifier les dépendances
npm install

# Rebuild
eas build --platform ios --profile production --clear-cache
```

---

## 📊 Métriques de Succès

### Objectifs Techniques
- ✅ Taux de crash < 1%
- ✅ Temps de réponse API < 500ms
- ✅ Disponibilité backend > 99.5%
- ✅ Tests E2E > 95%

### Objectifs Utilisateurs
- ✅ Inscription en < 2 minutes
- ✅ Création de match en < 1 minute
- ✅ Notifications reçues en < 30 secondes

---

## 🔄 Mises à Jour Futures

### Pour déployer une mise à jour

```bash
# 1. Modifier le code
# 2. Tester localement
npm run test

# 3. Commit et push
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push

# 4. Build et submit
eas build --platform all --profile production
eas submit --platform all
```

### OTA Updates (Over-The-Air)

Pour les petites modifications (JS/assets uniquement, pas de code natif) :

```bash
eas update --branch production --message "Fix bug login"
```

Les utilisateurs reçoivent la mise à jour au prochain lancement de l'app.

---

## 📞 Support

### Ressources
- **Documentation Expo:** [docs.expo.dev](https://docs.expo.dev)
- **Documentation Supabase:** [supabase.com/docs](https://supabase.com/docs)
- **Sentry Docs:** [docs.sentry.io](https://docs.sentry.io)

### Fichiers Utiles
- `PRODUCTION_CHECKLIST.md` - Checklist détaillée
- `PRODUCTION_FIXES.md` - Corrections appliquées
- `DEPLOY_BACKEND.md` - Guide backend détaillé
- `TROUBLESHOOTING.md` - Problèmes courants

---

## 🎉 Félicitations !

Votre application VS Sport Connect est maintenant en production ! 🚀

**Prochaines étapes :**
1. Monitorer les métriques (Sentry, logs backend)
2. Collecter les feedbacks utilisateurs
3. Planifier les prochaines fonctionnalités
4. Optimiser les performances

**Bonne chance ! ⚽🏀🎾**
