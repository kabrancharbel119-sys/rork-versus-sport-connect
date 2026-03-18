# Système de Paiement pour Tournois

## Vue d'ensemble

Ce système gère les paiements centralisés pour les inscriptions aux tournois via **Wave** et **Orange Money**. Tous les paiements sont envoyés à un **numéro ADMIN unique** et validés manuellement par les administrateurs.

---

## Architecture

### 1. Tables de base de données

#### `tournament_payments`
Stocke tous les paiements pour les inscriptions aux tournois.

**Colonnes principales :**
- `tournament_id` : ID du tournoi
- `team_id` : ID de l'équipe
- `amount` : Montant du paiement
- `method` : 'wave' | 'orange'
- `receiver` : Toujours 'admin'
- `status` : 'pending' | 'submitted' | 'approved' | 'rejected'
- `screenshot_url` : URL de la capture d'écran (optionnel)
- `transaction_ref` : Référence de transaction (optionnel)
- `expected_sender_name` : Nom de l'expéditeur
- `validated_by` : ID de l'admin qui a validé
- `payment_deadline` : Date limite (2h après soumission)

**Contrainte :** 1 paiement par équipe par tournoi (UNIQUE)

#### `tournament_teams`
Gère les inscriptions et statuts des équipes.

**Statuts possibles :**
- `pending_payment` : Équipe inscrite, en attente de paiement
- `payment_submitted` : Paiement soumis, en attente de validation
- `confirmed` : Paiement validé, équipe confirmée
- `rejected` : Paiement rejeté
- `cancelled` : Inscription annulée (deadline dépassée)

#### `payment_logs`
Logs de toutes les actions sur les paiements pour traçabilité.

---

## Flow utilisateur

### Étape 1 : Inscription
```typescript
await tournamentsApi.registerTeam(tournamentId, teamId);
// → Crée une entrée dans tournament_teams avec status = 'pending_payment'
```

### Étape 2 : Instructions de paiement
L'utilisateur voit :
- Montant à payer
- Numéros Wave et Orange Money (centralisés)
- Référence à indiquer : `{Nom équipe} - {Nom tournoi}`

### Étape 3 : Paiement externe
L'utilisateur effectue le paiement via Wave ou Orange Money vers le numéro ADMIN.

### Étape 4 : Soumission de la preuve
```typescript
await tournamentPaymentsApi.submitPayment({
  tournamentId,
  teamId,
  amount,
  method: 'wave' | 'orange',
  screenshotUrl: '...', // OU
  transactionRef: 'REF123',
  expectedSenderName: 'John Doe',
});
// → status = 'submitted'
// → team.status = 'payment_submitted'
// → payment_deadline = now + 2h
```

### Étape 5 : Validation ADMIN
```typescript
// Approuver
await tournamentPaymentsApi.approvePayment(paymentId, adminId);
// → payment.status = 'approved'
// → team.status = 'confirmed'

// Rejeter
await tournamentPaymentsApi.rejectPayment(paymentId, adminId, reason);
// → payment.status = 'rejected'
// → team.status = 'rejected'
```

---

## Gestion des places

### Vérification des places disponibles
```sql
SELECT has_available_spots(tournament_id);
-- Retourne true si : confirmed + payment_submitted < max_teams
```

### Comptage des places réservées
```sql
SELECT count_reserved_spots(tournament_id);
-- Compte les équipes avec status IN ('confirmed', 'payment_submitted')
```

### Annulation automatique des paiements expirés
```sql
SELECT cancel_expired_payments();
-- Annule les paiements dont payment_deadline < NOW()
-- Met à jour team.status = 'cancelled'
```

**À exécuter via CRON ou manuellement par admin.**

---

## Configuration

### Numéros de paiement (ADMIN)
Fichier : `lib/api/tournament-payments.ts`

```typescript
export const PAYMENT_CONFIG = {
  wave: {
    number: '+225 07 XX XX XX XX',
    name: 'Versus Sport',
  },
  orange: {
    number: '+225 05 XX XX XX XX',
    name: 'Versus Sport',
  },
  paymentDeadlineHours: 2,
};
```

**⚠️ IMPORTANT :** Modifier ces numéros avec les vrais numéros ADMIN avant la mise en production.

---

## API Endpoints

### Pour les utilisateurs

#### Soumettre un paiement
```typescript
tournamentPaymentsApi.submitPayment({
  tournamentId: string,
  teamId: string,
  amount: number,
  method: 'wave' | 'orange',
  screenshotUrl?: string,
  transactionRef?: string,
  expectedSenderName: string,
})
```

#### Mettre à jour un paiement
```typescript
tournamentPaymentsApi.updatePayment(
  tournamentId,
  teamId,
  {
    screenshotUrl?: string,
    transactionRef?: string,
    expectedSenderName?: string,
  }
)
```

#### Récupérer le paiement d'une équipe
```typescript
tournamentPaymentsApi.getPayment(tournamentId, teamId)
```

### Pour les ADMINS

#### Récupérer tous les paiements en attente
```typescript
tournamentPaymentsApi.getPendingPayments()
// Retourne tous les paiements avec status = 'submitted'
```

#### Approuver un paiement
```typescript
tournamentPaymentsApi.approvePayment(paymentId, adminId)
```

#### Rejeter un paiement
```typescript
tournamentPaymentsApi.rejectPayment(paymentId, adminId, reason?)
```

#### Récupérer les logs d'un paiement
```typescript
tournamentPaymentsApi.getPaymentLogs(paymentId)
```

#### Annuler les paiements expirés
```typescript
tournamentPaymentsApi.cancelExpiredPayments()
```

---

## Sécurité (RLS)

### `tournament_payments`
- **SELECT** : Capitaine/membres de l'équipe + admins
- **INSERT** : Capitaine de l'équipe uniquement
- **UPDATE** : Admins uniquement

### `tournament_teams`
- **SELECT** : Tout le monde
- **INSERT** : Capitaine de l'équipe uniquement
- **UPDATE** : Admins + capitaine de l'équipe

### `payment_logs`
- **SELECT** : Admins + membres de l'équipe concernée
- **INSERT** : Tout le monde (via triggers)

---

## Composants UI

### `PaymentInstructions`
Affiche les instructions de paiement avec :
- Montant à payer
- Numéros Wave/Orange
- Boutons de copie
- Référence à indiquer

**Usage :**
```tsx
<PaymentInstructions
  amount={tournament.entryFee}
  tournamentName={tournament.name}
  teamName={team.name}
  onMethodSelect={(method) => setSelectedMethod(method)}
/>
```

### `PaymentSubmissionModal` (À créer)
Modal pour soumettre la preuve de paiement :
- Upload de capture d'écran
- Input pour référence de transaction
- Input pour nom de l'expéditeur

### Page Admin Payments (À créer)
Interface admin pour :
- Voir tous les paiements en attente
- Approuver/rejeter les paiements
- Voir l'historique des paiements

---

## Badges de statut

```typescript
const statusConfig = {
  pending_payment: {
    label: 'En attente paiement',
    color: Colors.status.warning,
    icon: '🟡',
  },
  payment_submitted: {
    label: 'Paiement soumis',
    color: Colors.primary.orange,
    icon: '🟠',
  },
  confirmed: {
    label: 'Confirmé',
    color: Colors.status.success,
    icon: '🟢',
  },
  rejected: {
    label: 'Rejeté',
    color: Colors.status.error,
    icon: '🔴',
  },
  cancelled: {
    label: 'Annulé',
    color: Colors.text.muted,
    icon: '⚫',
  },
};
```

---

## Distribution future (préparé mais non utilisé)

Les champs suivants sont déjà en place pour une future automatisation :

- `payout_status` : 'pending' | 'sent'
- `organizer_amount` : Montant pour l'organisateur
- `platform_fee` : Frais de plateforme

**Ces champs ne sont pas utilisés actuellement** mais permettront de gérer la distribution automatique des fonds aux organisateurs dans le futur.

---

## Migration

Pour activer le système :

```bash
# Exécuter la migration SQL
psql -d your_database < supabase/migrations/20260317_tournament_payments_system.sql
```

Ou via Supabase Dashboard :
1. Aller dans SQL Editor
2. Copier le contenu de `20260317_tournament_payments_system.sql`
3. Exécuter

---

## Tests recommandés

1. **Inscription équipe**
   - Vérifier création dans `tournament_teams` avec status `pending_payment`

2. **Soumission paiement**
   - Vérifier création dans `tournament_payments`
   - Vérifier mise à jour status équipe → `payment_submitted`
   - Vérifier `payment_deadline` = now + 2h

3. **Validation admin**
   - Approuver : status → `approved`, team → `confirmed`
   - Rejeter : status → `rejected`, team → `rejected`

4. **Gestion places**
   - Vérifier qu'on ne peut pas dépasser `max_teams`
   - Vérifier que `payment_submitted` réserve une place

5. **Expiration**
   - Vérifier annulation automatique après deadline

---

## Logs et traçabilité

Toutes les actions sont loggées automatiquement dans `payment_logs` :
- Création de paiement
- Changement de statut
- Validation/rejet par admin

**Exemple de log :**
```json
{
  "payment_id": "uuid",
  "action": "status_changed",
  "performed_by": "admin_id",
  "details": {
    "old_status": "submitted",
    "new_status": "approved",
    "validated_at": "2026-03-17T20:30:00Z"
  },
  "timestamp": "2026-03-17T20:30:00Z"
}
```

---

## Points importants

✅ **Tous les paiements vont vers un numéro ADMIN unique**  
✅ **Validation manuelle obligatoire par admin**  
✅ **Aucune équipe confirmée sans paiement validé**  
✅ **Gestion automatique des places**  
✅ **Système de deadline (2h) pour soumettre la preuve**  
✅ **Traçabilité complète via logs**  
✅ **RLS configuré pour sécurité**  
✅ **Prêt pour automatisation future**

---

## Support

Pour toute question ou problème :
1. Vérifier les logs dans `payment_logs`
2. Vérifier les statuts dans `tournament_teams`
3. Vérifier la configuration dans `PAYMENT_CONFIG`
