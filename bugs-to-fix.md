# 🐛 VS Sport - Bugs à Corriger

**Date:** 02/03/2026
**Score Qualité:** 98/100
**Total Bugs:** 4

## 📊 Résumé

- 🔴 **Critical:** 2 bugs
- 🟠 **High:** 0 bugs
- 🟡 **Medium:** 2 bugs
- 🟢 **Low:** 0 bugs

---


## 1. ✅ Connexion valide → token peut être utilisé pour requêtes authentifiées

**Fichier:** `01-auth.test.ts`
**Sévérité:** 🟡 MEDIUM

### 🔍 Cause
Erreur non identifiée

### 💡 Correction
```
Vérifier les logs pour plus de détails
```

### ❌ Erreur
```
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeNull[2m()[22m

Received: [31m{"hint": "Double check your Supabase `anon` or `service_role` API key.", "message": "Invalid API key"}[39m
    at Object.<anonymous> (C:\Users\kabra\rork-versus-sport-connect\__tests__\e2e\01-auth.test.ts:88:19)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

---


## 2. ✅ Supprimer un user → user retiré de la BDD

**Fichier:** `11-admin.test.ts`
**Sévérité:** 🟡 MEDIUM

### 🔍 Cause
Erreur non identifiée

### 💡 Correction
```
Vérifier les logs pour plus de détails
```

### ❌ Erreur
```
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

Expected: [32m0[39m
Received: [31m1[39m
    at Object.<anonymous> (C:\Users\kabra\rork-versus-sport-connect\__tests__\e2e\11-admin.test.ts:126:26)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

---


## 3. ❌ UserA lit les notifications de UserB → refusé

**Fichier:** `12-rls-security.test.ts`
**Sévérité:** 🔴 CRITICAL

### 🔍 Cause
Violation de sécurité RLS

### 💡 Correction
```
Vérifier les politiques RLS dans Supabase et s'assurer que les permissions sont correctement configurées
```

### ❌ Erreur
```
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeNull[2m()[22m

Received: [31m{"hint": "Double check your Supabase `anon` or `service_role` API key.", "message": "Invalid API key"}[39m
    at Object.<anonymous> (C:\Users\kabra\rork-versus-sport-connect\__tests__\e2e\12-rls-security.test.ts:61:19)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

---


## 4. ❌ Injection SQL dans search query → neutralisée

**Fichier:** `12-rls-security.test.ts`
**Sévérité:** 🔴 CRITICAL

### 🔍 Cause
Violation de sécurité RLS

### 💡 Correction
```
Vérifier les politiques RLS dans Supabase et s'assurer que les permissions sont correctement configurées
```

### ❌ Erreur
```
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeNull[2m()[22m

Received: [31m{"hint": "Double check your Supabase `anon` or `service_role` API key.", "message": "Invalid API key"}[39m
    at Object.<anonymous> (C:\Users\kabra\rork-versus-sport-connect\__tests__\e2e\12-rls-security.test.ts:99:19)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
```

---


## ✅ Actions Recommandées

1. Corriger d'abord les bugs **Critical** (sécurité, données perdues)
2. Puis les bugs **High** (fonctionnalités principales cassées)
3. Ensuite les bugs **Medium** (comportements inattendus)
4. Enfin les bugs **Low** (cosmétiques, performance)

## 📝 Notes

- Exécuter les tests après chaque correction: `npm run test:e2e`
- Vérifier que le score qualité augmente
- Documenter les corrections dans le changelog
