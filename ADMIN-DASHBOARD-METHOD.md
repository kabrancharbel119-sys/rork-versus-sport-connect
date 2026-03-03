# ✅ Méthode Simple : Créer l'Admin via Dashboard

## 🎯 Pourquoi Cette Méthode ?

Les scripts SQL créent des problèmes avec le hash du mot de passe. La méthode Dashboard est **100% fiable**.

---

## 🚀 Étapes (3 minutes)

### **ÉTAPE 1 : Créer le Compte dans Supabase Dashboard**

1. Ouvrir **[Supabase Dashboard](https://app.supabase.com)**
2. Aller dans **Authentication → Users**
3. Cliquer sur **"Add user"** (bouton vert en haut à droite)
4. Remplir le formulaire :
   - **Email :** `kabrancharbel1@gmail.com`
   - **Password :** `Kouame2002$`
   - **Auto Confirm User :** ✅ **COCHER** (important !)
5. Cliquer sur **"Create user"**

### **ÉTAPE 2 : Copier l'UUID**

1. Dans la liste, cliquer sur `kabrancharbel1@gmail.com`
2. **Copier l'UUID** (ex: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### **ÉTAPE 3 : Créer le Profil Admin**

1. Aller dans **SQL Editor**
2. Exécuter ce script (remplacer `VOTRE_UUID` par l'UUID copié) :

```sql
-- Remplacer VOTRE_UUID par l'UUID du compte créé
INSERT INTO public.users (
  id,
  email,
  username,
  full_name,
  city,
  country,
  role,
  is_verified,
  is_premium,
  referral_code,
  stats,
  bio,
  reputation,
  wallet_balance,
  created_at,
  updated_at
) VALUES (
  'VOTRE_UUID',  -- ⚠️ REMPLACER ICI
  'kabrancharbel1@gmail.com',
  'charbel_admin',
  'Charbel Kabran',
  'Abidjan',
  'Côte d''Ivoire',
  'admin',
  true,
  true,
  'VSADMIN2',
  jsonb_build_object(
    'matchesPlayed', 0,
    'wins', 0,
    'losses', 0,
    'draws', 0,
    'goalsScored', 0,
    'assists', 0,
    'mvpCount', 0,
    'fairPlayScore', 5,
    'tournamentsWon', 0,
    'cashPrizesTotal', 0
  ),
  '',
  5.0,
  0.00,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  is_premium = EXCLUDED.is_premium,
  updated_at = NOW();

-- Vérifier
SELECT id, email, username, role FROM public.users WHERE email = 'kabrancharbel1@gmail.com';
```

---

## ✅ Tester

1. Lancer l'app : `npx expo start`
2. Se connecter avec :
   - **Email :** `kabrancharbel1@gmail.com`
   - **Mot de passe :** `Kouame2002$`

---

## 🎉 Résultat

Cette méthode fonctionne à **100%** car :
- ✅ Supabase gère le hash du mot de passe correctement
- ✅ Toutes les tables auth.* sont configurées automatiquement
- ✅ Pas d'erreur "Database error querying schema"
- ✅ Login immédiat sans problème

**C'est la méthode la plus simple et la plus fiable !**
