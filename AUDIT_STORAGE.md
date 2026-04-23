# Audit Complet du Stockage Local vs Supabase

## Résumé Exécutif

**État**: ⚠️ MIXTE - Certaines données sont encore stockées localement et doivent migrer vers Supabase

## Données qui DOIVENT migrer vers Supabase (CRITIQUE)

### 1. ❌ VerificationRequests (SupportContext)
- **Clé**: `vs_verification_requests`
- **Problème**: Les demandes de vérification de compte sont stockées localement
- **Impact**: Admin ne peut pas voir les demandes de tous les utilisateurs
- **Solution**: Créer table `verification_requests` dans Supabase

### 2. ❌ Referral System (ReferralContext)
- **Clé**: `vs_referrals`
- **Problème**: Système de parrainage entièrement local
- **Impact**: Codes parrainage non persistants, récompenses non traçables
- **Solution**: Créer table `referrals` dans Supabase

### 3. ❌ Trophies (TrophiesContext)
- **Clé**: `vs_user_trophies`
- **Problème**: Trophées débloqués stockés localement
- **Impact**: Perte des trophées si changement d'appareil
- **Solution**: Créer table `user_trophies` dans Supabase

### 4. ❌ Chat Messages (ChatContext)
- **Clés**: `vs_chats`, `vs_messages`
- **Problème**: Messages stockés localement
- **Impact**: Messages perdus si changement d'appareil, pas de sync entre devices
- **Solution**: Vérifier si `chatApi` utilise Supabase, sinon migrer

## Données avec Cache Local Acceptable (OK avec sync)

### 1. ✅ Teams (TeamsContext)
- **Clé**: `vs_teams`
- **État**: Cache local + Sync Supabase via `teamsApi`
- **Verdict**: ✅ ACCEPTABLE - Données source = Supabase

### 2. ✅ Matches (MatchesContext)
- **Clé**: `vs_matches`
- **État**: Cache local + Sync Supabase via `matchesApi`
- **Verdict**: ✅ ACCEPTABLE - Données source = Supabase

### 3. ✅ Tournaments (TournamentsContext)
- **Clé**: `vs_tournaments`
- **État**: Cache local + Sync Supabase via `tournamentsApi`
- **Verdict**: ✅ ACCEPTABLE - Données source = Supabase

### 4. ✅ Support Tickets (SupportContext)
- **État**: Migré vers Supabase ✅
- **Table**: `support_tickets`
- **Verdict**: ✅ CORRECT

### 5. ✅ Users (AuthContext)
- **Clés**: `vs_auth`, `vs_user`
- **État**: Cache profil utilisateur + Session Supabase
- **Verdict**: ✅ ACCEPTABLE - Auth gérée par Supabase

### 6. ✅ Notifications (NotificationsContext)
- **Clé**: `vs_notifications_{userId}`
- **État**: Cache local + Supabase via `notificationsApi`
- **Verdict**: ✅ ACCEPTABLE - Données source = Supabase

## Données Purement Locales (OK)

### 1. ✅ Offline Queue (lib/offline.ts)
- **Clé**: `vs_offline_queue`
- **Usage**: File d'attente offline temporaire
- **Verdict**: ✅ CORRECT - Doit rester local

### 2. ✅ I18n Locale (I18nContext)
- **Usage**: Préférence de langue
- **Verdict**: ✅ CORRECT - Setting utilisateur local

### 3. ✅ Last Sync (lib/offline.ts)
- **Clé**: `vs_last_sync`
- **Usage**: Timestamp dernière sync
- **Verdict**: ✅ CORRECT - Meta info locale

## Actions Requises

### 1. Créer les tables manquantes dans Supabase

```sql
-- verification_requests (manquant)
-- referrals (manquant)
-- user_trophies (manquant)
-- Vérifier chat_messages (existe ?)
```

### 2. Créer les APIs correspondantes

- `lib/api/verifications.ts`
- `lib/api/referrals.ts`
- `lib/api/trophies.ts`

### 3. Migrer les contextes

- `SupportContext` - Terminer migration verificationRequests
- `ReferralContext` - Migrer vers Supabase
- `TrophiesContext` - Migrer vers Supabase
- `ChatContext` - Vérifier/vérifier sync Supabase

## Fichiers à Modifier

### Haute Priorité (Critique)
1. `contexts/SupportContext.tsx` - VerificationRequests
2. `contexts/ReferralContext.tsx` - Referral system
3. `contexts/TrophiesContext.tsx` - Trophies
4. `contexts/ChatContext.tsx` - Messages

### Moyenne Priorité (Amélioration)
5. Nettoyer vieux stockage local après migration

## Statistiques

| Type | Count |
|------|-------|
| ✅ Supabase | 6 |
| ⚠️ Cache Local + Sync | 4 |
| ❌ Local uniquement | 4 |
| **Total** | **14** |

**Progrès**: ~60% migré vers Supabase

## Notes

- Les données avec cache local + sync Supabase sont acceptables pour l'expérience offline
- Les données purement locales doivent être migrées impérativement
- Le système de parrainage est actuellement inutilisable en production
