# ✅ Solution Simple : Créer le Compte Admin dans Supabase Auth

## 🎯 Problème
L'erreur "Invalid login credentials" signifie que le compte **`kabrancharbel@gmail.com`** n'existe pas encore dans **Supabase Auth**.

---

## 🚀 Solution en 3 Étapes (5 minutes)

### **ÉTAPE 1 : Créer le Compte dans Supabase Auth Dashboard**

1. Ouvrir **[Supabase Dashboard](https://app.supabase.com)**
2. Sélectionner votre projet
3. Aller dans **Authentication → Users**
4. Cliquer sur **"Add user"** (bouton vert en haut à droite)
5. Remplir le formulaire :
   - **Email :** `kabrancharbel@gmail.com`
   - **Password :** `Kouame2002$`
   - **Auto Confirm User :** ✅ **Cocher cette case** (important !)
6. Cliquer sur **"Create user"**

### **ÉTAPE 2 : Récupérer l'UUID du Compte Créé**

1. Dans **Authentication → Users**, chercher `kabrancharbel@gmail.com`
2. Cliquer sur l'utilisateur
3. **Copier l'UUID** (format : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### **ÉTAPE 3 : Mettre à Jour la Table `users`**

1. Aller dans **SQL Editor**
2. Exécuter ce script (remplacer `VOTRE_UUID_ICI` par l'UUID copié) :

```sql
-- Remplacer VOTRE_UUID_ICI par l'UUID du compte créé à l'étape 2
DO $$
DECLARE
  new_auth_id uuid := 'VOTRE_UUID_ICI'; -- ⚠️ REMPLACER ICI
  old_user_id uuid;
BEGIN
  -- Trouver l'ancien compte admin
  SELECT id INTO old_user_id
  FROM public.users
  WHERE phone = '+14385089540' OR username = 'charbel_kabran'
  LIMIT 1;

  IF old_user_id IS NULL THEN
    RAISE EXCEPTION 'Ancien compte admin introuvable';
  END IF;

  -- Mettre à jour l'ID pour correspondre au compte Supabase Auth
  UPDATE public.users
  SET 
    id = new_auth_id,
    email = 'kabrancharbel@gmail.com',
    updated_at = NOW()
  WHERE id = old_user_id;

  RAISE NOTICE 'Compte admin mis à jour avec succès !';
  RAISE NOTICE 'UUID : %', new_auth_id;
  RAISE NOTICE 'Email : kabrancharbel@gmail.com';
END $$;

-- Vérifier le résultat
SELECT id, email, username, phone, role, is_verified, is_premium
FROM public.users
WHERE email = 'kabrancharbel@gmail.com';
```

---

## ✅ Tester la Connexion

1. Lancer l'application : `npx expo start`
2. Aller sur l'écran de connexion
3. Entrer :
   - **Email :** `kabrancharbel@gmail.com`
   - **Mot de passe :** `Kouame2002$`
4. Cliquer sur **"Se connecter"**

---

## 🔍 Pourquoi Cette Approche ?

- ✅ **Plus simple** : Utilise l'interface Supabase (pas de SQL complexe)
- ✅ **Plus fiable** : Supabase gère automatiquement le hash du mot de passe
- ✅ **Plus sûr** : Pas de manipulation manuelle des tables auth.*
- ✅ **Confirmation auto** : Le compte est immédiatement utilisable

---

## ⚠️ Alternative : Si le Compte Existe Déjà

Si vous avez déjà créé un compte `kabrancharbel@gmail.com` dans Supabase Auth :

1. **Récupérer l'UUID** du compte dans **Authentication → Users**
2. **Exécuter uniquement l'ÉTAPE 3** ci-dessus pour synchroniser les IDs

---

## 📝 Résumé

| Action | Où | Quoi |
|--------|-----|------|
| 1. Créer compte | **Dashboard → Authentication → Users** | Email + Password + Auto Confirm |
| 2. Copier UUID | **Dashboard → Authentication → Users** | UUID du compte créé |
| 3. Synchroniser | **SQL Editor** | Script SQL avec l'UUID |
| 4. Tester | **Application mobile** | Login avec email |

**C'est la méthode la plus simple et la plus fiable !** 🎉
