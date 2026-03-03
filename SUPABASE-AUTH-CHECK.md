# 🔍 Vérification Configuration Supabase Auth

## ❌ Erreur Actuelle

```
ERROR [Login] Error: [Error: Database error querying schema]
```

Cette erreur indique un problème de configuration Supabase Auth, pas un problème de code.

---

## ✅ Vérifications à Faire

### **1. Vérifier que Email Auth est Activé**

Dans **Supabase Dashboard** :

1. Aller dans **Authentication → Providers**
2. Vérifier que **Email** est activé (toggle ON)
3. **IMPORTANT :** Désactiver "Confirm email" temporairement
   - Aller dans **Authentication → Settings**
   - Sous "Email Auth", décocher **"Enable email confirmations"**
   - Sauvegarder

### **2. Vérifier le Compte Admin**

Dans **SQL Editor**, exécuter :

```sql
-- Vérifier auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  encrypted_password IS NOT NULL as has_password
FROM auth.users
WHERE email = 'kabrancharbel1@gmail.com';

-- Vérifier public.users
SELECT 
  id,
  email,
  username,
  role
FROM public.users
WHERE email = 'kabrancharbel1@gmail.com';

-- Vérifier que les IDs correspondent
SELECT 
  CASE 
    WHEN a.id = p.id THEN '✅ IDs correspondent'
    WHEN a.id IS NULL THEN '❌ Compte auth.users manquant'
    WHEN p.id IS NULL THEN '❌ Profil public.users manquant'
    ELSE '❌ IDs différents'
  END as status,
  a.id as auth_id,
  a.email as auth_email,
  p.id as public_id,
  p.email as public_email
FROM auth.users a
FULL OUTER JOIN public.users p ON a.email = p.email
WHERE a.email = 'kabrancharbel1@gmail.com' OR p.email = 'kabrancharbel1@gmail.com';
```

### **3. Supprimer les Comptes en Double**

Si plusieurs comptes existent, supprimer les anciens :

```sql
-- Lister tous les comptes avec cet email
SELECT id, email, created_at FROM auth.users WHERE email LIKE '%kabrancharbel%';

-- Supprimer les anciens (garder seulement 81d7aa73-2aa7-4b4e-bb72-c0fcae790f21)
DELETE FROM auth.users WHERE email = 'kabrancharbel1@gmail.com' AND id != '81d7aa73-2aa7-4b4e-bb72-c0fcae790f21';
```

### **4. Vérifier les Variables d'Environnement**

Dans le fichier `.env` ou `.env.local`, vérifier :

```env
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
```

**IMPORTANT :** Redémarrer l'app après modification du `.env` :
```bash
npx expo start --clear
```

---

## 🔧 Solution Alternative : Réinitialiser le Compte

Si rien ne fonctionne, créer un compte complètement neuf :

### **Étape 1 : Nettoyer**

```sql
-- Supprimer tous les comptes kabrancharbel
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%kabrancharbel%'
);
DELETE FROM auth.users WHERE email LIKE '%kabrancharbel%';
DELETE FROM public.users WHERE email LIKE '%kabrancharbel%';
```

### **Étape 2 : Créer via Dashboard**

1. **Authentication → Users → Add user**
2. Email : `admin@vsport.com`
3. Password : `Kouame2002$`
4. Auto Confirm : ✅
5. Créer

### **Étape 3 : Copier UUID et Créer Profil**

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
  'VOTRE_UUID',
  'admin@vsport.com',
  'admin',
  'Admin VSport',
  'Abidjan',
  'Côte d''Ivoire',
  'admin',
  true,
  true,
  'VSADMIN',
  '{"matchesPlayed":0,"wins":0,"losses":0,"draws":0,"goalsScored":0,"assists":0,"mvpCount":0,"fairPlayScore":5,"tournamentsWon":0,"cashPrizesTotal":0}'::jsonb,
  '',
  5.0,
  0.00,
  NOW(),
  NOW()
);
```

### **Étape 4 : Tester**

```bash
npx expo start --clear
```

Login :
- Email : `admin@vsport.com`
- Password : `Kouame2002$`

---

## 📋 Checklist de Débogage

- [ ] Email provider activé dans Supabase
- [ ] Email confirmations désactivées
- [ ] Compte existe dans `auth.users`
- [ ] Profil existe dans `public.users`
- [ ] Les IDs correspondent
- [ ] Pas de comptes en double
- [ ] Variables d'environnement correctes
- [ ] Cache vidé avec `--clear`

---

## 🆘 Si Rien Ne Fonctionne

L'erreur "Database error querying schema" peut aussi venir de :
- Permissions RLS (Row Level Security) trop restrictives
- Problème de connexion Supabase
- Clé API incorrecte

Vérifier les **RLS policies** sur la table `users` :
```sql
-- Voir les policies
SELECT * FROM pg_policies WHERE tablename = 'users';
```

Si nécessaire, désactiver temporairement RLS pour tester :
```sql
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
```

**⚠️ NE PAS OUBLIER DE RÉACTIVER RLS APRÈS LE TEST !**
