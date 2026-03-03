# 🔧 Étapes pour Corriger le Login

## ⚠️ Problème Actuel

L'app utilise encore l'ancien UUID `f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055` en cache.

---

## ✅ Solution en 3 Étapes

### **ÉTAPE 1 : Vérifier que le Profil Existe**

Dans **Supabase Dashboard → SQL Editor**, exécuter :

```sql
-- Vérifier que le profil admin existe
SELECT id, email, username, role 
FROM public.users 
WHERE id = '81d7aa73-2aa7-4b4e-bb72-c0fcae790f21';
```

**Résultat attendu :**
```
id: 81d7aa73-2aa7-4b4e-bb72-c0fcae790f21
email: kabrancharbel1@gmail.com
username: charbel_admin
role: admin
```

Si **aucun résultat**, exécuter le script `supabase-create-admin-profile-dashboard.sql`.

---

### **ÉTAPE 2 : Vider le Cache de l'Application**

#### **Option A : Supprimer et Réinstaller l'App (Recommandé)**
1. Supprimer l'application de votre téléphone/simulateur
2. Relancer : `npx expo start`
3. Réinstaller l'app

#### **Option B : Vider le Cache AsyncStorage (Plus Rapide)**

Dans le terminal, arrêter l'app (`Ctrl+C`) puis :

```bash
# Vider le cache Expo
npx expo start --clear
```

Ou ajouter ce code temporaire dans `app/auth/login.tsx` (avant le return) :

```typescript
// TEMPORAIRE - À supprimer après test
useEffect(() => {
  AsyncStorage.multiRemove(['vs_auth', 'vs_user']);
}, []);
```

---

### **ÉTAPE 3 : Tester le Login**

1. Ouvrir l'app
2. Aller sur l'écran de connexion
3. Entrer :
   - **Email :** `kabrancharbel1@gmail.com`
   - **Mot de passe :** `Kouame2002$`
4. Se connecter

---

## 🔍 Vérifier les Logs

Après avoir cliqué sur "Se connecter", vous devriez voir :

```
✅ [Auth] Attempting login for: kabrancharbel1@gmail.com
✅ [Auth] Login successful
```

**PAS** :
```
❌ ERROR [Login] Error: Utilisateur non trouvé
❌ ERROR database error querying schema
```

---

## 🎯 Si Ça Ne Fonctionne Toujours Pas

Vérifier dans **Supabase Dashboard → Authentication → Users** :
- Le compte `kabrancharbel1@gmail.com` existe
- Il est confirmé (email_confirmed_at rempli)
- L'UUID correspond bien à celui dans `public.users`

Puis essayer de réinitialiser le mot de passe via le Dashboard :
1. Cliquer sur le compte
2. "Send password recovery"
3. Ou "Reset password" et entrer `Kouame2002$`

---

## 📝 Résumé

1. ✅ Vérifier que le profil existe dans `public.users`
2. ✅ Vider le cache : `npx expo start --clear`
3. ✅ Tester le login avec `kabrancharbel1@gmail.com`

**Le problème vient du cache, pas du SQL !**
