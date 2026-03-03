# Mise à Jour du Compte Admin : Email au lieu de Téléphone

## 📧 Nouvelles Identifiants

**Email :** `kabrancharbel@gmail.com`  
**Mot de passe :** `Kouame2002$`

---

## 🚀 Instructions d'Exécution

### Étape 1 : Ouvrir Supabase Dashboard

1. Aller sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionner votre projet
3. Aller dans **SQL Editor**

### Étape 2 : Exécuter le Script SQL

1. Cliquer sur **"New Query"**
2. Copier-coller le contenu du fichier : **`supabase-update-admin-email.sql`**
3. Cliquer sur **"Run"** ou appuyer sur `Ctrl+Enter`

### Étape 3 : Vérifier les Messages

Le script affichera des messages de confirmation :
```
✅ Compte admin trouvé : [UUID]
✅ Email mis à jour dans public.users
✅ Email mis à jour dans auth.users
✅ Identité email créée/mise à jour
```

### Étape 4 : Tester la Connexion

1. Lancer l'application : `npx expo start`
2. Aller sur l'écran de connexion
3. Entrer :
   - **Email :** `kabrancharbel@gmail.com`
   - **Mot de passe :** `Kouame2002$`
4. Cliquer sur "Se connecter"

---

## 🔍 Ce que Fait le Script

Le script SQL effectue automatiquement :

1. **Recherche du compte admin** par téléphone `+14385089540` ou username `charbel_kabran`
2. **Met à jour l'email** dans la table `public.users` → `kabrancharbel@gmail.com`
3. **Met à jour ou crée** le compte dans `auth.users` avec le nouvel email
4. **Crée/met à jour** l'identité email dans `auth.identities`
5. **Confirme l'email** automatiquement (pas besoin de vérification)

---

## ✅ Vérifications Incluses

À la fin du script, des requêtes SELECT affichent :

- ✅ Le compte dans `public.users` avec le nouvel email
- ✅ Le compte dans `auth.users` avec confirmation email
- ✅ L'identité email dans `auth.identities`

---

## 🔐 Sécurité

- Le mot de passe reste **`Kouame2002$`** (inchangé)
- Le hash du mot de passe est régénéré automatiquement par Supabase
- L'email est confirmé automatiquement (pas de vérification requise)
- Le compte garde tous ses privilèges : **admin**, **verified**, **premium**

---

## 📱 Compatibilité

- ✅ **Connexion par email** : Fonctionne immédiatement
- ✅ **Téléphone conservé** : Le numéro `+14385089540` reste dans le profil
- ✅ **Backend** : Compatible avec les routes backend si `EXPO_PUBLIC_USE_BACKEND_AUTH=true`

---

## ⚠️ En Cas de Problème

### Problème : "Email already in use"

Si l'email `kabrancharbel@gmail.com` existe déjà dans `auth.users` :

1. Aller dans **Supabase Dashboard → Authentication → Users**
2. Chercher `kabrancharbel@gmail.com`
3. Supprimer ce compte s'il existe
4. Réexécuter le script SQL

### Problème : "Invalid login credentials"

1. Vérifier que le script s'est exécuté sans erreur
2. Vérifier dans **Authentication → Users** que l'email apparaît
3. Essayer de réinitialiser le mot de passe via l'écran "Mot de passe oublié"

### Problème : Le compte n'est pas trouvé

Si le script dit "Compte admin introuvable" :

1. Vérifier dans `public.users` :
   ```sql
   SELECT * FROM public.users WHERE phone = '+14385089540' OR username = 'charbel_kabran';
   ```
2. Si aucun résultat, exécuter d'abord : `supabase-seed-default-admin.sql`
3. Puis réexécuter : `supabase-update-admin-email.sql`

---

## 📝 Résumé

Après l'exécution du script :

| Avant | Après |
|-------|-------|
| Téléphone : `+14385089540` | Email : `kabrancharbel@gmail.com` |
| Mot de passe : `Kouame2002$` | Mot de passe : `Kouame2002$` ✅ |
| Connexion par téléphone | Connexion par email ✅ |

**Le compte admin peut maintenant se connecter avec l'email !** 🎉
