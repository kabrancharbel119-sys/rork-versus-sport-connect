# Migration: Authentification par Email

## ✅ Changements Effectués

### 1. Nouveau Système d'Authentification (`lib/api/auth.ts`)

Création d'un nouveau module d'authentification basé sur Supabase Auth avec les fonctions suivantes:

- **`signUp()`** - Inscription avec email/password + création du profil utilisateur
- **`signIn()`** - Connexion avec email/password
- **`signOut()`** - Déconnexion
- **`resetPassword()`** - Réinitialisation du mot de passe par email
- **`getCurrentUser()`** - Récupération du profil utilisateur connecté

### 2. Mise à Jour du Contexte d'Authentification (`contexts/AuthContext.tsx`)

- ✅ Remplacement de l'authentification par téléphone par email
- ✅ Intégration avec Supabase Auth (`supabase.auth.getSession()`)
- ✅ Mise à jour des interfaces `RegisterData` et `LoginData`
- ✅ Gestion automatique de la session Supabase

**Nouvelles interfaces:**
```typescript
interface RegisterData {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  city?: string;
  referralCode?: string;
}

interface LoginData {
  email: string;
  password: string;
}
```

### 3. Écrans d'Authentification Mis à Jour

#### **`app/auth/register.tsx`**
- ✅ Champ Email (avec validation)
- ✅ Champ Nom d'utilisateur
- ✅ Champ Prénom
- ✅ Champ Nom
- ✅ Champ Mot de passe (minimum 8 caractères recommandés)
- ✅ Champ Confirmation du mot de passe
- ✅ Champ Code de parrainage (optionnel)
- ❌ Supprimé: PhoneInput et validation du numéro

#### **`app/auth/login.tsx`**
- ✅ Champ Email (avec validation)
- ✅ Champ Mot de passe
- ✅ Lien "Mot de passe oublié ?"
- ❌ Supprimé: PhoneInput

#### **`app/auth/forgot-password.tsx`** (NOUVEAU)
- ✅ Formulaire de réinitialisation par email
- ✅ Envoi du lien de réinitialisation via Supabase
- ✅ Redirection configurée: `vsport://reset-password`

### 4. Backend Auth Routes (`backend/auth-routes.ts`)

Mise à jour pour supporter **à la fois email ET téléphone** (rétrocompatibilité):

- ✅ Login accepte `email` OU `phone`
- ✅ Register accepte `email` OU `phone` (au moins un requis)
- ✅ Validation des emails en double
- ✅ Génération automatique d'email factice si seul le téléphone est fourni

### 5. Migration SQL (`supabase-migration-email-auth.sql`)

Script SQL créé pour:
- ✅ Rendre `phone` optionnel (DROP NOT NULL)
- ✅ Supprimer la contrainte unique sur `phone`
- ✅ Garantir que `email` est NOT NULL et UNIQUE
- ✅ Créer un index sur `email` pour les performances

---

## 📋 Étapes à Suivre Manuellement

### ÉTAPE 1 — SUPABASE DASHBOARD

1. **Aller dans Authentication → Providers**
   - Phone → **Désactiver** (toggle OFF)
   - Email → **Vérifier que c'est ON**

2. **Aller dans Authentication → Settings**
   - "Enable email confirmations" → **OFF**
     (pour simplifier le flux, pas de confirmation email requise)
   - Sauvegarder

### ÉTAPE 2 — EXÉCUTER LA MIGRATION SQL

Dans **Supabase SQL Editor**, exécuter le fichier:
```
supabase-migration-email-auth.sql
```

Ou copier-coller le contenu du fichier dans l'éditeur SQL.

### ÉTAPE 3 — TESTER L'APPLICATION

1. Lancer l'application:
   ```bash
   npx expo start
   ```

2. Tester le flux complet:
   - ✅ Inscription avec email + mot de passe
   - ✅ Connexion avec email + mot de passe
   - ✅ Déconnexion
   - ✅ Mot de passe oublié (vérifier l'email)

3. Vérifier dans **Supabase Dashboard → Authentication → Users**
   - Les nouveaux utilisateurs apparaissent avec leur email
   - Le champ `phone` peut être vide

---

## 🔍 Compatibilité et Points d'Attention

### ✅ Tests E2E
Les tests existants dans `__tests__/e2e/01-auth.test.ts` continuent de fonctionner car:
- Le fichier `setup.js` crée déjà des utilisateurs avec email via `supabaseAdmin.auth.admin.createUser()`
- Les tests utilisent à la fois `email` et `phone`

### ✅ Utilisateurs Existants
- Les utilisateurs créés avec téléphone peuvent toujours se connecter via le backend (si `EXPO_PUBLIC_USE_BACKEND_AUTH=true`)
- Le champ `phone` reste dans la table `users` pour référence future
- Possibilité d'ajouter le téléphone comme méthode de vérification 2FA plus tard

### ⚠️ Champ `phone` dans le Profil
Le champ `phone` reste disponible dans:
- `UpdateProfileData` interface
- Table `users` (optionnel)
- Les utilisateurs peuvent ajouter leur numéro dans leur profil

### 🔐 Sécurité du Mot de Passe
- Supabase impose un minimum de **6 caractères**
- L'UI recommande **8+ caractères** pour plus de sécurité
- Les mots de passe sont hashés par Supabase Auth

---

## 📁 Fichiers Modifiés

### Nouveaux Fichiers
- ✅ `lib/api/auth.ts` - Module d'authentification Supabase
- ✅ `app/auth/forgot-password.tsx` - Écran de réinitialisation
- ✅ `supabase-migration-email-auth.sql` - Script de migration
- ✅ `MIGRATION-EMAIL-AUTH.md` - Cette documentation

### Fichiers Modifiés
- ✅ `contexts/AuthContext.tsx` - Contexte d'authentification
- ✅ `app/auth/register.tsx` - Écran d'inscription
- ✅ `app/auth/login.tsx` - Écran de connexion
- ✅ `backend/auth-routes.ts` - Routes backend (rétrocompatibilité)

### Fichiers Non Modifiés (Important)
- ✅ `lib/api/users.ts` - Conservé pour compatibilité backend
- ✅ `__tests__/e2e/01-auth.test.ts` - Tests fonctionnent sans modification
- ✅ `components/PhoneInput.tsx` - Conservé pour usage futur (profil utilisateur)

---

## 🚀 Prochaines Étapes (Optionnel)

### 1. Vérification Email (Production)
Si vous souhaitez activer la vérification par email:
```typescript
// Dans lib/api/auth.ts, modifier signUp():
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: data.email,
  password: data.password,
  options: {
    emailRedirectTo: 'vsport://verify-email',
  }
});
```

Puis dans Supabase Dashboard:
- Authentication → Settings → Enable email confirmations → **ON**

### 2. Authentification à Deux Facteurs (2FA)
Supabase supporte nativement la 2FA par:
- SMS (via Twilio)
- TOTP (Google Authenticator, etc.)

### 3. OAuth Social Login
Ajouter des providers sociaux:
- Google
- Facebook
- Apple
- GitHub

---

## 📞 Support

En cas de problème:
1. Vérifier les logs dans la console
2. Vérifier Supabase Dashboard → Logs
3. Tester avec un email valide (pas @local.app)
4. Vérifier que la migration SQL a bien été exécutée

---

## ✨ Résumé

L'application utilise maintenant **Supabase Auth** avec authentification par **email/password**:
- ✅ Plus simple et plus standard
- ✅ Pas de gestion d'OTP/SMS
- ✅ Réinitialisation de mot de passe intégrée
- ✅ Prêt pour la production
- ✅ Compatible avec les utilisateurs existants (via backend)
- ✅ Extensible (2FA, OAuth, etc.)

**Le système d'authentification est maintenant complètement basé sur l'email !** 🎉
