# 🏆 Système de Live Scoring et Classement Global

## Vue d'ensemble

Ce document décrit le système complet de **Live Scoring** (scoring en direct) et **Classement Global** (ranking ELO) implémenté dans l'application.

---

## 📊 Live Scoring

### Fonctionnalités

Le système de live scoring permet de :
- ✅ Suivre les matchs en temps réel
- ✅ Enregistrer tous les événements (buts, cartons, remplacements, etc.)
- ✅ Afficher une timeline interactive des événements
- ✅ Calculer et afficher les statistiques en direct
- ✅ Envoyer des notifications push pour les événements importants
- ✅ Permettre aux spectateurs de suivre le match en direct

### Types d'événements

```typescript
- goal: But marqué
- yellow_card: Carton jaune
- red_card: Carton rouge
- substitution: Remplacement
- penalty: Penalty
- own_goal: But contre son camp
- assist: Passe décisive
- save: Arrêt du gardien
- injury: Blessure
- timeout: Temps mort
- period_start: Début de période
- period_end: Fin de période
- match_start: Début du match
- match_end: Fin du match
```

### Architecture

#### 1. Tables Supabase

**match_events**
- Stocke tous les événements d'un match
- Champs: type, minute, période, joueur, équipe, métadonnées
- Index sur match_id, type, timestamp

**live_match_stats**
- Statistiques en temps réel du match
- Score actuel, période, minute
- Statistiques détaillées par équipe
- Timeline des événements

#### 2. API (lib/api/live-scoring.ts)

```typescript
// Créer un événement
await liveScoringApi.createMatchEvent({
  matchId: 'xxx',
  type: 'goal',
  minute: 23,
  period: 'first_half',
  teamId: 'yyy',
  playerId: 'zzz',
  playerName: 'John Doe',
  assistPlayerId: 'aaa',
  assistPlayerName: 'Jane Smith',
  createdBy: userId
});

// Démarrer un match en live
await liveScoringApi.startLiveMatch(matchId, homeTeamId, awayTeamId);

// Ajouter un but
await liveScoringApi.addGoal(
  matchId, teamId, playerId, playerName, 
  minute, period, assistPlayerId, assistPlayerName
);

// Ajouter un carton
await liveScoringApi.addCard(
  matchId, teamId, playerId, playerName,
  minute, period, 'yellow_card', 'Faute tactique'
);

// Terminer un match
await liveScoringApi.endLiveMatch(matchId);

// S'abonner aux événements en temps réel
const unsubscribe = liveScoringApi.subscribeToMatchEvents(
  matchId,
  (event) => {
    console.log('Nouvel événement:', event);
  }
);
```

#### 3. Notifications automatiques

Le système envoie automatiquement des notifications push pour :
- ⚽ Buts marqués
- 🟥 Cartons rouges
- 🏁 Début et fin de match

### Statistiques trackées

**Par équipe:**
- Buts
- Tirs (total et cadrés)
- Possession (%)
- Passes (total et réussies)
- Fautes
- Corners
- Hors-jeu
- Cartons (jaunes et rouges)
- Arrêts du gardien

**Par joueur:**
- Buts
- Passes décisives
- Tirs (total et cadrés)
- Passes (total et réussies)
- Tacles
- Interceptions
- Fautes
- Cartons
- Minutes jouées
- Note (0-10)

---

## 🏅 Système de Classement Global

### Fonctionnalités

Le système de classement permet de :
- ✅ Calculer le classement ELO de chaque joueur
- ✅ Maintenir des classements par sport
- ✅ Créer des leaderboards (global, par ville, par sport)
- ✅ Suivre la progression dans le temps
- ✅ Débloquer des achievements et badges
- ✅ Afficher les statistiques détaillées

### Système ELO

#### Formule de calcul

```
Score attendu = 1 / (1 + 10^((ELO_adversaire - ELO_joueur) / 400))
Changement ELO = K × (Score_réel - Score_attendu)
Nouveau ELO = ELO_actuel + Changement_ELO
```

#### K-Factor (facteur de volatilité)

- **40** : Joueurs avec < 30 matchs (apprentissage rapide)
- **32** : Joueurs standards (1200-2000 ELO)
- **24** : Joueurs élite (> 2000 ELO, plus stable)

#### Scores réels

- Victoire : 1.0
- Match nul : 0.5
- Défaite : 0.0

#### ELO initial

- Tous les joueurs commencent à **1200 ELO**

### Architecture

#### 1. Tables Supabase

**player_rankings**
- Classement ELO de chaque joueur
- Statistiques globales (matchs, victoires, buts, etc.)
- Classements par sport
- Achievements et badges
- Historique de progression

**team_rankings**
- Classement ELO des équipes
- Statistiques d'équipe
- Classement par sport

**ranking_history**
- Historique quotidien du classement
- Permet de tracer des graphiques de progression

**ranking_updates**
- Journal de toutes les mises à jour de classement
- Achievements débloqués
- Badges gagnés

#### 2. API (lib/api/ranking.ts)

```typescript
// Récupérer le classement d'un joueur
const ranking = await rankingApi.getPlayerRanking(userId);

// Mettre à jour après un match
const update = await rankingApi.updatePlayerRankingAfterMatch(
  userId,
  matchId,
  'win', // 'win' | 'loss' | 'draw'
  opponentElo,
  'football',
  goals: 2,
  assists: 1,
  rating: 8.5
);

// Récupérer le leaderboard global
const leaderboard = await rankingApi.getGlobalLeaderboard(100);

// Récupérer le leaderboard par sport
const footballLeaderboard = await rankingApi.getSportLeaderboard('football', 100);

// Récupérer le leaderboard par ville
const cityLeaderboard = await rankingApi.getCityLeaderboard('Abidjan', 100);
```

### Statistiques trackées

**Globales:**
- Total de matchs
- Victoires / Défaites / Nuls
- Taux de victoire (%)
- Total de buts
- Total de passes décisives
- Note moyenne
- Série de victoires actuelle
- Plus longue série de victoires
- Forme récente (10 derniers matchs)
- Performance récente (score 0-100)

**Par sport:**
- ELO spécifique au sport
- Rang dans le sport
- Statistiques du sport

### Achievements (Succès)

#### Types d'achievements

| Type | Nom | Description | Rareté |
|------|-----|-------------|--------|
| first_win | Première victoire | Remportez votre premier match | Common |
| win_streak_5 | Série de 5 | Gagnez 5 matchs d'affilée | Rare |
| win_streak_10 | Série de 10 | Gagnez 10 matchs d'affilée | Epic |
| win_streak_20 | Série de 20 | Gagnez 20 matchs d'affilée | Legendary |
| goals_10 | 10 buts | Marquez 10 buts | Common |
| goals_50 | Buteur confirmé | Marquez 50 buts | Rare |
| goals_100 | Légende du but | Marquez 100 buts | Epic |
| assists_50 | Passeur d'élite | Donnez 50 passes décisives | Rare |
| elo_1500 | Joueur confirmé | Atteignez 1500 ELO | Rare |
| elo_1800 | Joueur avancé | Atteignez 1800 ELO | Epic |
| elo_2000 | Élite | Atteignez 2000 ELO | Legendary |
| top_10_global | Top 10 mondial | Entrez dans le top 10 global | Legendary |
| top_10_city | Top 10 ville | Entrez dans le top 10 de votre ville | Epic |
| perfect_month | Mois parfait | Gagnez tous vos matchs du mois | Epic |
| hat_trick | Triplé | Marquez 3 buts dans un match | Rare |

### Badges

Les badges sont des distinctions visuelles affichées sur le profil.

| Type | Nom | Condition | Couleur |
|------|-----|-----------|---------|
| top_1_global | Champion du monde | Rang #1 global | Or (#FFD700) |
| top_10_global | Top 10 mondial | Rang ≤ 10 global | Argent (#C0C0C0) |
| top_100_global | Top 100 mondial | Rang ≤ 100 global | Bronze (#CD7F32) |
| elite_player | Joueur élite | ELO ≥ 2000 | Violet (#9333EA) |
| goal_machine | Machine à buts | 100+ buts | Orange (#FF6B00) |
| playmaker | Meneur de jeu | 50+ assists | Bleu (#1565C0) |
| veteran | Vétéran | 100+ matchs | Gris (#6B7280) |

### Leaderboards

#### 1. Classement Global
- Top 100 joueurs tous sports confondus
- Trié par ELO décroissant
- Mis à jour en temps réel

#### 2. Classement par Sport
- Top 100 par sport (football, basketball, etc.)
- Basé sur l'ELO spécifique au sport
- Permet de comparer les joueurs du même sport

#### 3. Classement par Ville
- Top 100 de chaque ville
- Favorise la compétition locale
- Basé sur l'ELO global

#### 4. Classement par Période
- All-time (tous les temps)
- Season (saison en cours)
- Month (mois en cours)
- Week (semaine en cours)

---

## 🔄 Flux de travail complet

### 1. Avant le match

```typescript
// Le créateur du match démarre le live scoring
await liveScoringApi.startLiveMatch(matchId, homeTeamId, awayTeamId);
```

### 2. Pendant le match

```typescript
// Événement: But marqué
await liveScoringApi.addGoal(
  matchId, teamId, playerId, playerName,
  23, 'first_half', assistPlayerId, assistPlayerName
);

// Événement: Carton jaune
await liveScoringApi.addCard(
  matchId, teamId, playerId, playerName,
  45, 'first_half', 'yellow_card', 'Faute sur le porteur'
);

// Les spectateurs reçoivent des notifications push
// La timeline se met à jour en temps réel
```

### 3. Fin du match

```typescript
// Terminer le match
await liveScoringApi.endLiveMatch(matchId);

// Mettre à jour le classement de chaque joueur
for (const player of homePlayers) {
  const opponentElo = await rankingApi.calculateTeamAverageElo(awayTeamId);
  await rankingApi.updatePlayerRankingAfterMatch(
    player.userId,
    matchId,
    homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'draw',
    opponentElo,
    match.sport,
    player.goals,
    player.assists,
    player.rating
  );
}

// Les joueurs reçoivent des notifications de mise à jour de classement
// Les achievements sont débloqués automatiquement
// Les badges sont attribués automatiquement
```

---

## 📱 Interfaces utilisateur

### 1. Écran de match en direct

- **Header** : Score en temps réel, période, minute
- **Timeline** : Liste chronologique des événements
- **Statistiques** : Onglets pour voir les stats détaillées
- **Actions** : Boutons pour ajouter des événements (réservé au créateur)

### 2. Écran de classement

- **Onglets** : Global, Par sport, Par ville
- **Carte de joueur** : Avatar, nom, ELO, rang, badges
- **Statistiques** : Matchs, victoires, taux de victoire
- **Graphique** : Progression de l'ELO dans le temps
- **Achievements** : Liste des succès débloqués

### 3. Profil joueur

- **ELO actuel** : Gros chiffre avec tendance (↑↓)
- **Rang** : Position dans le classement global
- **Badges** : Affichés en haut du profil
- **Statistiques** : Tableau complet des stats
- **Forme récente** : W-L-W-W-D (5 derniers matchs)
- **Achievements** : Grille de tous les achievements

---

## 🔔 Notifications

### Événements de match

- ⚽ **But** : "⚽ But ! John Doe marque pour Team A (2-1)"
- 🟨 **Carton jaune** : "🟨 Carton jaune pour Jane Smith"
- 🟥 **Carton rouge** : "🟥 Carton rouge ! John Doe expulsé"
- 🏁 **Début** : "🏁 Team A vs Team B - Le match a commencé !"
- 🏁 **Fin** : "🏁 Match terminé - Team A 3-2 Team B"

### Mises à jour de classement

- 📈 **ELO positif** : "🎉 +25 ELO ! Nouveau classement: 1450"
- 📉 **ELO négatif** : "-15 ELO. Classement: 1385"
- 🏆 **Achievement** : "🏆 Achievement débloqué : Série de 5 !"
- 👑 **Badge** : "👑 Nouveau badge : Top 10 mondial !"
- 📊 **Nouveau rang** : "📊 Vous êtes maintenant #42 mondial !"

---

## 🎯 Exemples de calculs ELO

### Exemple 1 : Victoire attendue

```
Joueur A : 1500 ELO
Joueur B : 1400 ELO
Résultat : A gagne

Score attendu A = 1 / (1 + 10^((1400-1500)/400)) = 0.64
Changement ELO = 32 × (1 - 0.64) = +11.5 ≈ +12
Nouveau ELO A = 1500 + 12 = 1512
```

### Exemple 2 : Victoire surprise

```
Joueur A : 1300 ELO
Joueur B : 1600 ELO
Résultat : A gagne

Score attendu A = 1 / (1 + 10^((1600-1300)/400)) = 0.15
Changement ELO = 32 × (1 - 0.15) = +27.2 ≈ +27
Nouveau ELO A = 1300 + 27 = 1327
```

### Exemple 3 : Match nul

```
Joueur A : 1500 ELO
Joueur B : 1500 ELO
Résultat : Nul

Score attendu A = 1 / (1 + 10^((1500-1500)/400)) = 0.5
Changement ELO = 32 × (0.5 - 0.5) = 0
Nouveau ELO A = 1500 (pas de changement)
```

---

## 🚀 Déploiement

### 1. Créer les tables Supabase

```bash
# Exécuter le script SQL
psql -h your-supabase-host -U postgres -d postgres -f supabase/migrations/create_live_scoring_and_ranking.sql
```

### 2. Configurer les permissions RLS

Les politiques RLS sont déjà définies dans le script SQL.

### 3. Tester le système

```typescript
// Test live scoring
const matchId = 'test-match-id';
await liveScoringApi.startLiveMatch(matchId, homeTeamId, awayTeamId);
await liveScoringApi.addGoal(matchId, homeTeamId, playerId, 'John', 10, 'first_half');

// Test ranking
const ranking = await rankingApi.getPlayerRanking(userId);
console.log('ELO:', ranking.eloRating);
console.log('Rang:', ranking.rank);
```

---

## 📊 Métriques et Analytics

### Métriques à suivre

- **Engagement** : Nombre de matchs suivis en live
- **Rétention** : Joueurs actifs revenant pour améliorer leur classement
- **Compétition** : Nombre de joueurs dans le top 100
- **Achievements** : Taux de déblocage des achievements
- **Notifications** : Taux d'ouverture des notifications de match

### Optimisations possibles

1. **Cache** : Mettre en cache les leaderboards (refresh toutes les 5 min)
2. **Pagination** : Paginer les leaderboards pour de meilleures performances
3. **Indexation** : Ajouter des index sur les colonnes fréquemment requêtées
4. **Websockets** : Utiliser Supabase Realtime pour les mises à jour instantanées
5. **Background jobs** : Recalculer les rangs en arrière-plan

---

## 🎨 Design et UX

### Principes de design

1. **Temps réel** : Les mises à jour doivent être instantanées
2. **Gamification** : Achievements et badges pour encourager l'engagement
3. **Compétition** : Leaderboards visibles et motivants
4. **Progression** : Graphiques montrant l'évolution dans le temps
5. **Feedback** : Notifications claires et motivantes

### Couleurs

- **ELO positif** : Vert (#10B981)
- **ELO négatif** : Rouge (#EF4444)
- **Achievements** : Or (#FFD700)
- **Badges** : Selon le type (voir tableau badges)
- **Live** : Orange pulsant (#FF6B00)

---

## 🔒 Sécurité

### Validations

- ✅ Seul le créateur du match peut ajouter des événements
- ✅ Les événements ne peuvent pas être modifiés (seulement supprimés)
- ✅ Le système de ranking est automatique (pas de manipulation manuelle)
- ✅ Les achievements sont vérifiés côté serveur
- ✅ Les notifications sont envoyées uniquement aux joueurs concernés

### Anti-triche

- ✅ Vérification de la cohérence des événements (pas de but à la minute -5)
- ✅ Limitation du nombre d'événements par minute
- ✅ Audit trail de toutes les modifications
- ✅ Détection des patterns suspects (trop de victoires faciles)

---

## 📝 TODO / Améliorations futures

- [ ] Système de paris sur les matchs
- [ ] Prédictions basées sur l'ELO
- [ ] Tournois avec classement séparé
- [ ] Saisons avec reset partiel de l'ELO
- [ ] Système de divisions (Bronze, Silver, Gold, etc.)
- [ ] Matchmaking automatique basé sur l'ELO
- [ ] Replay des matchs avec timeline
- [ ] Statistiques avancées (heatmaps, etc.)
- [ ] Intégration avec wearables pour stats automatiques
- [ ] Machine learning pour détection automatique d'événements

---

## 🤝 Support

Pour toute question ou problème :
- Documentation : Ce fichier
- Code : `lib/api/live-scoring.ts` et `lib/api/ranking.ts`
- Types : `types/live-scoring.ts` et `types/ranking.ts`
- SQL : `supabase/migrations/create_live_scoring_and_ranking.sql`
