# 🧪 Suite de Tests E2E - VS Sport

Suite de tests end-to-end exhaustive pour détecter 100% des bugs potentiels dans l'application VS Sport.

## 📋 Vue d'ensemble

Cette suite de tests couvre **15 domaines fonctionnels** avec plus de **220 tests** :

1. **01-auth.test.ts** - Authentification (inscription, connexion, profil, parrainage)
2. **02-matches-creation.test.ts** - Création et gestion de matchs
3. **03-live-scoring.test.ts** - Live scoring et événements de match
4. **04-teams.test.ts** - Création et gestion d'équipes
5. **05-tournaments.test.ts** - Tournois (création, inscriptions, brackets)
6. **06-ranking-elo.test.ts** - Système ELO et classements
7. **07-notifications.test.ts** - Notifications (création, gestion)
8. **08-chat.test.ts** - Chat d'équipe et messages privés
9. **09-venues.test.ts** - Terrains (données, filtres)
10. **10-trophies.test.ts** - Trophées et achievements
11. **11-admin.test.ts** - Panneau admin et permissions
12. **12-rls-security.test.ts** - Sécurité RLS et isolation des données
13. **13-api-types.test.ts** - Cohérence des types JSONB et enums
14. **14-performance-edge-cases.test.ts** - Performance et cas limites
15. **15-integration-flows.test.ts** - Flux complets d'intégration

## 🚀 Installation

```bash
# Les dépendances sont déjà installées
npm install
```

## ⚙️ Configuration

1. **Créer le fichier `.env.test`** à la racine du projet :

```env
TEST_SUPABASE_URL=https://votre-projet.supabase.co
TEST_SUPABASE_ANON_KEY=votre_anon_key
TEST_SUPABASE_SERVICE_KEY=votre_service_role_key
```

⚠️ **IMPORTANT** : Utilisez une base de données de TEST, jamais la production !

2. **Préparer la base de données de test** :
   - Créer un projet Supabase dédié aux tests
   - Exécuter tous les scripts de migration dans `supabase/migrations/`
   - Exécuter `complete_venues_setup.sql` pour créer les terrains

## 🏃 Exécution des tests

### Exécuter tous les tests

```bash
npm run test:e2e
```

### Exécuter avec rapport complet

```bash
npm run test:e2e:report
```

Cela génère :
- `test-report.html` - Rapport visuel interactif
- `test-report.json` - Données brutes JSON
- `bugs-to-fix.md` - Liste des bugs avec corrections
- `test-results-detailed.json` - Résultats détaillés

### Exécuter un fichier spécifique

```bash
npx jest --config jest.config.e2e.js __tests__/e2e/01-auth.test.ts
```

## 📊 Rapport de Tests

Après l'exécution, vous obtenez :

### Terminal
```
┌─────────────────────────────────────────┐
│        VS SPORT — TEST REPORT           │
├─────────────────────────────────────────┤
│  Total tests : 220                      │
│  ✅ Passés   : 198  (90%)               │
│  ❌ Échoués  : 18   (8%)                │
│  ⏭ Skippés  : 4    (2%)                │
│  Score qualité : 90/100                 │
├─────────────────────────────────────────┤
│  🐛 BUGS DÉTECTÉS (18)                  │
│  🔴 Critical : 3                        │
│  🟠 High     : 7                        │
│  🟡 Medium   : 6                        │
│  🟢 Low      : 2                        │
└─────────────────────────────────────────┘
```

### Rapport HTML
Ouvrir `test-report.html` dans un navigateur pour :
- Dashboard visuel avec statistiques
- Résultats par fichier avec barres de progression
- Liste complète des bugs avec sévérité
- Corrections suggérées pour chaque bug

### Bugs à Corriger
Le fichier `bugs-to-fix.md` contient :
- Liste de tous les bugs détectés
- Sévérité (Critical/High/Medium/Low)
- Cause probable
- Correction suggérée avec code
- Ordre de priorité des corrections

## 🎯 Couverture des Tests

### ✅ Tests Positifs (ce qui doit fonctionner)
- Création de ressources (users, matches, teams, tournaments)
- Mise à jour de données
- Calculs ELO corrects
- Structures JSONB valides
- Filtres et recherches
- Permissions admin
- Notifications automatiques

### ❌ Tests Négatifs (ce qui doit être bloqué)
- Violations de contraintes (unique, FK, NOT NULL)
- Accès non autorisés (RLS)
- Injections SQL
- Données invalides (négatifs, null, types incorrects)
- Concurrence et race conditions

### 🔍 Tests de Sécurité
- Isolation des données entre users
- RLS (Row Level Security)
- Permissions admin vs user
- Injection SQL
- Manipulation de rôles

### ⚡ Tests de Performance
- Requêtes lourdes (< 2s)
- Recherches géographiques (< 1s)
- Top 100 ranking (< 1s)
- Profil complet (< 1s)

### 🎲 Tests de Cas Limites
- Match avec 0 joueur
- Équipe avec 1 seul membre
- Scores très élevés (50-0)
- ELO à 0 ou 9999
- Caractères spéciaux
- Concurrence (2 users rejoignent simultanément)

## 🐛 Classification des Bugs

### 🔴 Critical
- App crash
- Données perdues
- Sécurité compromise
- RLS bypassé

### 🟠 High
- Fonctionnalité principale cassée
- Calcul ELO incorrect
- Type de données incorrect
- Contrainte FK violée

### 🟡 Medium
- Comportement inattendu mais non bloquant
- Performance dégradée
- Validation manquante

### 🟢 Low
- Cosmétique
- Performance mineure
- Edge case rare

## 🔧 Helpers Disponibles

Le fichier `setup.ts` fournit :

### Clients Supabase
- `supabaseAdmin` - Client avec service_role_key (bypass RLS)
- `supabaseAnon` - Client avec anon_key (teste RLS)
- `supabaseAsUser(token)` - Client authentifié

### Fonctions de Création
- `createTestUser(overrides?)` - Crée un user de test
- `createTestVenue(overrides?)` - Crée un terrain de test
- `createTestMatch(userId, venueId, overrides?)` - Crée un match de test
- `createTestTeam(captainId, overrides?)` - Crée une équipe de test
- `createTestTournament(userId, overrides?)` - Crée un tournoi de test
- `createTestPlayerRanking(userId, sport, elo?)` - Crée un ranking de test

### Utilitaires
- `cleanup(ids)` - Nettoie les données de test
- `fakePhone()` - Génère un numéro de téléphone unique
- `fakeUUID()` - Génère un UUID v4

## 📝 Écrire de Nouveaux Tests

```typescript
import { supabaseAdmin, createTestUser, cleanup } from './setup';

describe('MA FONCTIONNALITÉ', () => {
  const createdIds = { users: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Test positif → comportement attendu', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    // Votre test ici
    expect(user.id).toBeDefined();
  });

  test('❌ Test négatif → erreur attendue', async () => {
    await expect(
      createTestUser({ phone: 'invalid' })
    ).rejects.toThrow();
  });
});
```

## 🎯 Bonnes Pratiques

1. **Toujours nettoyer** - Utiliser `cleanup()` dans `afterAll()`
2. **Tests indépendants** - Chaque test crée ses propres données
3. **Pas d'IDs hardcodés** - Tout est dynamique
4. **Tester les deux côtés** - Positif ET négatif
5. **Vérifier les types JSONB** - Structure avant ET après insertion
6. **Tolérance ELO** - ±2 points sur les calculs
7. **Timeout Realtime** - 5000ms max

## 🚨 Dépannage

### Tests échouent avec "Missing Supabase credentials"
→ Vérifier que `.env.test` existe et contient les bonnes clés

### Tests échouent avec "Table does not exist"
→ Exécuter les migrations SQL dans Supabase

### Tests échouent avec "Terrain non trouvé"
→ Exécuter `complete_venues_setup.sql`

### Tests très lents
→ Vérifier la connexion à Supabase, utiliser une DB de test proche

### Cleanup échoue
→ Vérifier l'ordre de suppression (respecte les FK)

## 📚 Ressources

- [Jest Documentation](https://jestjs.io/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)

## 🎉 Objectif

**Score Qualité : 100/100**

Tous les tests doivent passer pour garantir :
- ✅ Aucun bug de logique
- ✅ Aucune violation RLS
- ✅ Aucun type incorrect
- ✅ Aucune incohérence JSONB
- ✅ Aucun edge case non géré
- ✅ Performance optimale
- ✅ Sécurité maximale

---

**Créé pour VS Sport** - Suite de tests exhaustive pour une qualité 100% 🏆
