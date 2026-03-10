# ✅ Checklist de Déploiement Production - VS Sport Connect

**Date de début:** ___________  
**Date de fin:** ___________  
**Responsable:** ___________

---

## 📋 Avant de Commencer

- [ ] Lire le `GUIDE_DEPLOIEMENT_PRODUCTION.md` en entier
- [ ] Créer une sauvegarde complète de la base de données Supabase
- [ ] Vérifier que tous les tests passent localement (`npm run test`)
- [ ] Exécuter le script de vérification: `node scripts/verify-production-ready.js`

---

## 🗄️ Étape 1 : Base de Données (30-45 min)

### 1.1 Préparation

- [ ] Se connecter au Dashboard Supabase
- [ ] Créer une sauvegarde manuelle (Settings → Database → Backups)
- [ ] Noter la date/heure de la sauvegarde: ___________

### 1.2 Vérification de l'état actuel

- [ ] Exécuter la requête de vérification des contraintes (voir guide)
- [ ] Exécuter la requête de vérification des politiques RLS
- [ ] Documenter l'état actuel (nombre de contraintes, politiques)

### 1.3 Nettoyage des données (si nécessaire)

- [ ] Identifier les données invalides (entry_fee < 0, max_players < 2, etc.)
- [ ] Nettoyer les données invalides avec les requêtes SQL du guide
- [ ] Vérifier qu'il n'y a plus de données invalides

### 1.4 Application de la migration

- [ ] Copier le contenu de `supabase/migrations/20260302_production_fixes.sql`
- [ ] Ouvrir SQL Editor dans Supabase Dashboard
- [ ] Coller et exécuter la migration
- [ ] Vérifier qu'il n'y a pas d'erreurs

### 1.5 Vérification post-migration

- [ ] Vérifier les 4 contraintes (matches_entry_fee_check, etc.)
- [ ] Vérifier les 4 politiques RLS sur notifications
- [ ] Vérifier les 4 index (idx_matches_venue_id, etc.)
- [ ] Tester la création d'un utilisateur (stats doivent être initialisés)

**Résultat:** ✅ Réussi / ❌ Échec  
**Notes:** ___________________________________________

---

## 🔐 Étape 2 : Variables d'Environnement (15-20 min)

### 2.1 Récupérer les clés Supabase

- [ ] Aller dans Supabase Dashboard → Settings → API
- [ ] Copier `SUPABASE_URL`: ___________
- [ ] Copier `anon key`: ___________
- [ ] Copier `service_role key` (⚠️ SECRÈTE): ___________

### 2.2 Choisir la plateforme backend

Plateforme choisie: [ ] Railway [ ] Render [ ] Fly.io [ ] VPS [ ] Autre: ___________

### 2.3 Configurer les variables backend

- [ ] `SUPABASE_URL` = ___________
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = ___________
- [ ] `ALLOWED_ORIGINS` = ___________
- [ ] `PORT` = 3000 (ou autre: _______)
- [ ] `RESEND_API_KEY` (optionnel) = ___________

### 2.4 Vérifier la configuration EAS

- [ ] Ouvrir `eas.json`
- [ ] Vérifier le profil `production`
- [ ] `EXPO_PUBLIC_USE_BACKEND_AUTH` = "true" ✅
- [ ] `EXPO_PUBLIC_RORK_API_BASE_URL` = ___________ (à mettre à jour après déploiement backend)
- [ ] `EXPO_PUBLIC_SUPABASE_URL` = ___________
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` = ___________

**Résultat:** ✅ Réussi / ❌ Échec  
**Notes:** ___________________________________________

---

## 🖥️ Étape 3 : Déploiement Backend (30-60 min)

### 3.1 Créer le projet sur la plateforme

- [ ] Créer un compte sur la plateforme choisie
- [ ] Créer un nouveau projet
- [ ] Connecter le dépôt GitHub (si applicable)

### 3.2 Configurer le build

- [ ] Build Command: `npm install`
- [ ] Start Command: `npm run backend`
- [ ] Root Directory: (laisser vide ou racine du projet)

### 3.3 Ajouter les variables d'environnement

- [ ] Ajouter toutes les variables de l'étape 2.3
- [ ] Vérifier qu'il n'y a pas de fautes de frappe
- [ ] Sauvegarder la configuration

### 3.4 Déployer

- [ ] Lancer le déploiement
- [ ] Attendre la fin du build (5-15 min)
- [ ] Noter l'URL attribuée: ___________

### 3.5 Vérifier le déploiement

- [ ] Tester: `curl https://VOTRE_URL/`
- [ ] Résultat attendu: `{"status":"ok","message":"API is running"}`
- [ ] Tester l'endpoint auth (voir guide)

### 3.6 Configurer le domaine personnalisé (optionnel)

- [ ] Ajouter le domaine: api.rork.com (ou autre: _______)
- [ ] Configurer le DNS (CNAME)
- [ ] Attendre la propagation DNS (5-30 min)
- [ ] Vérifier avec `curl https://api.rork.com/`

### 3.7 Mettre à jour l'URL dans l'app

- [ ] Modifier `eas.json` → production → `EXPO_PUBLIC_RORK_API_BASE_URL`
- [ ] Nouvelle URL: ___________
- [ ] Commit et push les changements

**URL Backend finale:** ___________  
**Résultat:** ✅ Réussi / ❌ Échec  
**Notes:** ___________________________________________

---

## 📊 Étape 4 : Monitoring (15-20 min)

### 4.1 Configurer Sentry

- [ ] Créer un compte sur sentry.io
- [ ] Créer un projet React Native
- [ ] Copier le DSN: ___________

### 4.2 Ajouter le DSN à l'app

**Option A - eas.json:**
- [ ] Ajouter `EXPO_PUBLIC_SENTRY_DSN` dans le profil production

**Option B - EAS Secrets (recommandé):**
- [ ] `eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "..."`

### 4.3 Configurer les alertes (optionnel)

- [ ] Configurer les notifications email
- [ ] Configurer les seuils d'alerte
- [ ] Tester avec une erreur volontaire

**Résultat:** ✅ Réussi / ❌ Échec / ⏭️ Sauté (optionnel)  
**Notes:** ___________________________________________

---

## 📄 Étape 5 : Pages Légales (20-30 min)

### 5.1 Vérifier le contenu

- [ ] Ouvrir `legal-pages/privacy/index.html`
- [ ] Vérifier que le contenu est complet et à jour
- [ ] Vérifier la conformité RGPD
- [ ] Ouvrir `legal-pages/terms/index.html`
- [ ] Vérifier que le contenu est complet et à jour

### 5.2 Déployer les pages

**Plateforme choisie:** [ ] Vercel [ ] Netlify [ ] GitHub Pages [ ] Autre: ___________

- [ ] Déployer le dossier `legal-pages/`
- [ ] Noter l'URL Privacy: ___________
- [ ] Noter l'URL Terms: ___________

### 5.3 Vérifier les URLs

- [ ] Tester l'URL Privacy dans un navigateur
- [ ] Tester l'URL Terms dans un navigateur
- [ ] Vérifier que les pages s'affichent correctement

### 5.4 Mettre à jour app.json (si nécessaire)

- [ ] Vérifier que les URLs dans `app.json` correspondent
- [ ] Commit et push si modifié

**Résultat:** ✅ Réussi / ❌ Échec  
**Notes:** ___________________________________________

---

## 🏗️ Étape 6 : Build de l'Application (60-90 min)

### 6.1 Prérequis

- [ ] Installer EAS CLI: `npm install -g @expo/eas-cli`
- [ ] Se connecter: `eas login`
- [ ] Email: ___________

### 6.2 Configuration EAS

- [ ] Exécuter: `eas build:configure`
- [ ] Vérifier que `eas.json` est correct

### 6.3 Build iOS

- [ ] Lancer: `eas build --platform ios --profile production`
- [ ] Suivre le build sur expo.dev
- [ ] Durée du build: _____ min
- [ ] Build ID: ___________
- [ ] Statut: ✅ Réussi / ❌ Échec

**Si échec:**
- [ ] Lire les logs d'erreur
- [ ] Corriger le problème
- [ ] Relancer le build

### 6.4 Build Android

- [ ] Lancer: `eas build --platform android --profile production`
- [ ] Suivre le build sur expo.dev
- [ ] Durée du build: _____ min
- [ ] Build ID: ___________
- [ ] Statut: ✅ Réussi / ❌ Échec

**Si échec:**
- [ ] Lire les logs d'erreur
- [ ] Corriger le problème
- [ ] Relancer le build

**Résultat:** ✅ Réussi / ❌ Échec  
**Notes:** ___________________________________________

---

## 🧪 Étape 7 : Tests Pré-Soumission (45-60 min)

### 7.1 Télécharger les builds

- [ ] Télécharger le build iOS
- [ ] Installer sur un appareil de test iOS
- [ ] Télécharger le build Android
- [ ] Installer sur un appareil de test Android

### 7.2 Tests fonctionnels iOS

- [ ] Inscription d'un nouvel utilisateur
- [ ] Connexion avec téléphone + mot de passe
- [ ] Création d'une équipe
- [ ] Création d'un match
- [ ] Rejoindre un match
- [ ] Notifications (si configurées)
- [ ] Géolocalisation
- [ ] Panneau admin (avec compte admin)

### 7.3 Tests fonctionnels Android

- [ ] Inscription d'un nouvel utilisateur
- [ ] Connexion avec téléphone + mot de passe
- [ ] Création d'une équipe
- [ ] Création d'un match
- [ ] Rejoindre un match
- [ ] Notifications (si configurées)
- [ ] Géolocalisation
- [ ] Panneau admin (avec compte admin)

### 7.4 Tests de performance

- [ ] Temps de chargement < 3 secondes
- [ ] Pas de crash pendant 10 minutes d'utilisation
- [ ] Vérifier Sentry (aucune erreur)
- [ ] Vérifier les logs backend (aucune erreur)

**Résultat:** ✅ Réussi / ❌ Échec  
**Notes:** ___________________________________________

---

## 📤 Étape 8 : Soumission aux Stores (30-45 min)

### 8.1 Prérequis App Store

- [ ] Compte Apple Developer actif (99$/an)
- [ ] Apple ID: ___________
- [ ] App-specific password créé
- [ ] Bundle identifier configuré dans app.json

### 8.2 Soumettre à l'App Store

- [ ] Exécuter: `eas submit --platform ios`
- [ ] Entrer les informations demandées
- [ ] Attendre la fin de la soumission
- [ ] Vérifier sur App Store Connect

### 8.3 Prérequis Google Play

- [ ] Compte Google Play Developer actif (25$ unique)
- [ ] Email: ___________
- [ ] Service account JSON key créé
- [ ] Package name configuré dans app.json

### 8.4 Soumettre à Google Play

- [ ] Exécuter: `eas submit --platform android`
- [ ] Entrer les informations demandées
- [ ] Attendre la fin de la soumission
- [ ] Vérifier sur Google Play Console

### 8.5 Informations stores

**App Store:**
- [ ] Ajouter captures d'écran
- [ ] Remplir la description
- [ ] Ajouter les mots-clés
- [ ] Configurer les prix
- [ ] Soumettre pour review

**Google Play:**
- [ ] Ajouter captures d'écran
- [ ] Remplir la description
- [ ] Configurer les prix
- [ ] Soumettre pour review

**Résultat:** ✅ Réussi / ❌ Échec  
**Notes:** ___________________________________________

---

## 🎉 Étape 9 : Post-Déploiement (Ongoing)

### 9.1 Monitoring (48 premières heures)

- [ ] Vérifier Sentry toutes les 4 heures
- [ ] Vérifier les logs backend toutes les 4 heures
- [ ] Vérifier les logs Supabase toutes les 4 heures
- [ ] Taux de crash: _____ % (objectif < 1%)

### 9.2 Métriques

- [ ] Nombre d'inscriptions: _____
- [ ] Nombre de connexions: _____
- [ ] Nombre de matchs créés: _____
- [ ] Temps de réponse API moyen: _____ ms (objectif < 500ms)

### 9.3 Feedback utilisateurs

- [ ] Configurer un canal de feedback (email, formulaire, etc.)
- [ ] Lire et répondre aux premiers feedbacks
- [ ] Documenter les bugs reportés

### 9.4 Documentation

- [ ] Créer un document de post-mortem
- [ ] Documenter les problèmes rencontrés
- [ ] Documenter les solutions appliquées
- [ ] Mettre à jour cette checklist si nécessaire

**Résultat:** ✅ En cours  
**Notes:** ___________________________________________

---

## 📊 Résumé Final

### Statut Global

- [ ] ✅ Base de données migrée
- [ ] ✅ Backend déployé
- [ ] ✅ Variables d'environnement configurées
- [ ] ✅ Monitoring configuré
- [ ] ✅ Pages légales déployées
- [ ] ✅ Builds iOS/Android réussis
- [ ] ✅ Tests pré-soumission passés
- [ ] ✅ Soumission aux stores effectuée

### URLs Importantes

| Service | URL |
|---------|-----|
| Backend API | ___________ |
| Privacy Policy | ___________ |
| Terms of Service | ___________ |
| Sentry Dashboard | ___________ |
| App Store Connect | https://appstoreconnect.apple.com |
| Google Play Console | https://play.google.com/console |

### Informations de Contact

| Rôle | Nom | Email |
|------|-----|-------|
| Responsable technique | ___________ | ___________ |
| Responsable produit | ___________ | ___________ |
| Support utilisateurs | ___________ | ___________ |

### Prochaines Étapes

1. [ ] Attendre l'approbation App Store (1-3 jours)
2. [ ] Attendre l'approbation Google Play (quelques heures à 1 jour)
3. [ ] Planifier la communication de lancement
4. [ ] Préparer le support utilisateurs
5. [ ] Planifier les prochaines fonctionnalités

---

## 🆘 En Cas de Problème

### Rollback Backend

```bash
# Sur Railway/Render
# Aller dans Deployments → Sélectionner le déploiement précédent → Redeploy
```

### Rollback Base de Données

```sql
-- Restaurer depuis la sauvegarde créée à l'étape 1.1
-- Dashboard Supabase → Settings → Database → Backups → Restore
```

### Contacts d'Urgence

- **Support Expo:** https://expo.dev/support
- **Support Supabase:** https://supabase.com/support
- **Support Sentry:** https://sentry.io/support

---

**Déploiement complété le:** ___________  
**Par:** ___________  
**Signature:** ___________

🎉 **Félicitations pour votre déploiement en production !**
