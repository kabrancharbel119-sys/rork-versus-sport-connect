# 🚀 Guide d'Utilisation Rapide - Live Scoring & Classement Global

## 📋 Étapes d'Installation

### 1. Créer les tables dans Supabase

```bash
# Connectez-vous à votre base de données Supabase et exécutez:
psql -h your-project.supabase.co -U postgres -d postgres -f supabase/migrations/create_live_scoring_and_ranking.sql

# Ou via l'interface Supabase SQL Editor:
# Copiez-collez le contenu du fichier SQL et exécutez
```

### 2. Ajouter la route dans le layout

Ouvrez `app/_layout.tsx` et ajoutez la route rankings:

```tsx
<Stack.Screen name="rankings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
```

### 3. Ajouter un lien vers les classements

Dans votre écran d'accueil ou menu, ajoutez un bouton:

```tsx
<TouchableOpacity onPress={() => router.push('/rankings')}>
  <Trophy size={24} color={Colors.primary.orange} />
  <Text>Classements</Text>
</TouchableOpacity>
```

---

## 🎮 Utilisation du Live Scoring

### Démarrer un match en live

```typescript
import { liveScoringApi } from '@/lib/api/live-scoring';

// Au début du match
await liveScoringApi.startLiveMatch(
  matchId,
  homeTeamId,
  awayTeamId
);
```

### Ajouter un but

```typescript
await liveScoringApi.addGoal(
  matchId,
  teamId,           // ID de l'équipe qui marque
  playerId,         // ID du joueur
  'John Doe',       // Nom du joueur
  23,               // Minute
  'first_half',     // Période
  assistPlayerId,   // ID de l'assistant (optionnel)
  'Jane Smith'      // Nom de l'assistant (optionnel)
);
```

### Ajouter un carton

```typescript
await liveScoringApi.addCard(
  matchId,
  teamId,
  playerId,
  'John Doe',
  45,
  'first_half',
  'yellow_card',    // ou 'red_card'
  'Faute tactique'  // Raison (optionnel)
);
```

### Terminer le match

```typescript
await liveScoringApi.endLiveMatch(matchId);
```

### S'abonner aux événements en temps réel

```typescript
const unsubscribe = liveScoringApi.subscribeToMatchEvents(
  matchId,
  (event) => {
    console.log('Nouvel événement:', event);
    // Mettre à jour l'UI
  }
);

// N'oubliez pas de se désabonner
return () => unsubscribe();
```

---

## 🏆 Utilisation du Classement

### Récupérer le classement d'un joueur

```typescript
import { rankingApi } from '@/lib/api/ranking';

const ranking = await rankingApi.getPlayerRanking(userId);

console.log('ELO:', ranking.eloRating);
console.log('Rang:', ranking.rank);
console.log('Victoires:', ranking.stats.wins);
```

### Mettre à jour après un match

```typescript
// À la fin du match, pour chaque joueur:
const update = await rankingApi.updatePlayerRankingAfterMatch(
  userId,
  matchId,
  'win',              // 'win' | 'loss' | 'draw'
  opponentElo,        // ELO moyen de l'équipe adverse
  'football',         // Sport
  2,                  // Buts marqués
  1,                  // Passes décisives
  8.5                 // Note du joueur (0-10)
);

// Le système calcule automatiquement:
// - Le nouveau ELO
// - Le nouveau rang
// - Les achievements débloqués
// - Les badges gagnés
// - Envoie les notifications
```

### Récupérer les leaderboards

```typescript
// Classement global
const global = await rankingApi.getGlobalLeaderboard(100);

// Classement par sport
const football = await rankingApi.getSportLeaderboard('football', 100);

// Classement par ville
const city = await rankingApi.getCityLeaderboard('Abidjan', 100);
```

---

## 💡 Exemples d'Intégration

### Dans l'écran de match

```typescript
// Bouton pour démarrer le live scoring
{match.status === 'confirmed' && (
  <Button
    title="Démarrer le match"
    onPress={async () => {
      await liveScoringApi.startLiveMatch(
        match.id,
        match.homeTeamId,
        match.awayTeamId
      );
      Alert.alert('Match démarré', 'Le live scoring est activé !');
    }}
  />
)}

// Bouton pour ajouter un but
<Button
  title="⚽ But"
  onPress={() => {
    // Ouvrir un modal pour sélectionner le joueur
    setShowGoalModal(true);
  }}
/>
```

### Dans le profil utilisateur

```typescript
const [ranking, setRanking] = useState<PlayerRanking | null>(null);

useEffect(() => {
  loadRanking();
}, [userId]);

const loadRanking = async () => {
  const data = await rankingApi.getPlayerRanking(userId);
  setRanking(data);
};

return (
  <View>
    <Text>ELO: {ranking?.eloRating}</Text>
    <Text>Rang: #{ranking?.rank}</Text>
    <Text>Victoires: {ranking?.stats.wins}</Text>
    
    {/* Badges */}
    {ranking?.badges.map(badge => (
      <View key={badge.id}>
        <Text>{badge.icon} {badge.name}</Text>
      </View>
    ))}
  </View>
);
```

---

## 🔔 Notifications Automatiques

Les notifications sont envoyées automatiquement pour:

### Événements de match
- ⚽ Buts marqués
- 🟥 Cartons rouges
- 🏁 Début et fin de match

### Mises à jour de classement
- 📈 Changement d'ELO significatif (≥20)
- 🏆 Achievements débloqués
- 👑 Badges gagnés
- 📊 Changement de rang important

**Aucune configuration nécessaire** - tout est automatique !

---

## 🎯 Workflow Complet d'un Match

```typescript
// 1. AVANT LE MATCH
// Le créateur démarre le live scoring
await liveScoringApi.startLiveMatch(matchId, homeTeamId, awayTeamId);

// 2. PENDANT LE MATCH
// Ajouter des événements au fur et à mesure
await liveScoringApi.addGoal(matchId, teamId, playerId, 'John', 10, 'first_half');
await liveScoringApi.addCard(matchId, teamId, playerId, 'Jane', 23, 'first_half', 'yellow_card');
await liveScoringApi.addGoal(matchId, teamId, playerId, 'Bob', 67, 'second_half', assistId, 'Alice');

// Les spectateurs reçoivent des notifications en temps réel
// La timeline se met à jour automatiquement

// 3. FIN DU MATCH
await liveScoringApi.endLiveMatch(matchId);

// 4. MISE À JOUR DES CLASSEMENTS
// Pour chaque joueur de l'équipe domicile
const opponentElo = await rankingApi.calculateTeamAverageElo(awayTeamId);
for (const player of homePlayers) {
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

// Pour chaque joueur de l'équipe extérieure
const homeElo = await rankingApi.calculateTeamAverageElo(homeTeamId);
for (const player of awayPlayers) {
  await rankingApi.updatePlayerRankingAfterMatch(
    player.userId,
    matchId,
    awayScore > homeScore ? 'win' : awayScore < homeScore ? 'loss' : 'draw',
    homeElo,
    match.sport,
    player.goals,
    player.assists,
    player.rating
  );
}

// Les joueurs reçoivent leurs notifications de classement
// Les achievements sont débloqués automatiquement
```

---

## 🐛 Dépannage

### Les tables n'existent pas
```
Erreur: relation "match_events" does not exist
Solution: Exécutez le script SQL de migration
```

### Les notifications ne s'envoient pas
```
Vérifiez que notificationsApi.addNotification existe
Si besoin, utilisez la méthode correcte de votre API
```

### Les classements ne se mettent pas à jour
```
Vérifiez que recalculateRanks() est appelé après chaque mise à jour
Vérifiez les permissions RLS dans Supabase
```

### Les événements ne s'affichent pas en temps réel
```
Vérifiez que Supabase Realtime est activé
Vérifiez que vous vous abonnez correctement avec subscribeToMatchEvents
```

---

## 📊 Métriques à Suivre

Pour mesurer le succès du système:

1. **Engagement**
   - Nombre de matchs avec live scoring actif
   - Nombre de spectateurs par match
   - Durée moyenne de suivi d'un match

2. **Compétition**
   - Nombre de joueurs actifs dans les classements
   - Nombre de joueurs dans le top 100
   - Progression moyenne de l'ELO par semaine

3. **Gamification**
   - Taux de déblocage des achievements
   - Nombre moyen d'achievements par joueur
   - Badges les plus populaires

4. **Rétention**
   - Joueurs revenant pour améliorer leur classement
   - Fréquence de consultation des leaderboards
   - Taux d'ouverture des notifications

---

## 🎨 Personnalisation

### Modifier les couleurs d'ELO

Dans `app/rankings.tsx`:

```typescript
const getEloColor = (elo: number) => {
  if (elo >= 2000) return '#9333EA'; // Elite
  if (elo >= 1800) return '#FFD700'; // Avancé
  if (elo >= 1500) return '#1565C0'; // Confirmé
  // ... personnalisez selon vos besoins
};
```

### Ajouter des achievements personnalisés

Dans `lib/api/ranking.ts`, méthode `checkAchievements`:

```typescript
{
  type: 'custom_achievement',
  condition: ranking.stats.totalGoals >= 200,
  name: 'Super Buteur',
  description: 'Marquez 200 buts',
  rarity: 'legendary',
}
```

### Modifier le K-Factor ELO

Dans `lib/api/ranking.ts`:

```typescript
private readonly K_FACTOR_BASE = 32;        // Standard
private readonly K_FACTOR_HIGH_ELO = 24;    // Elite
private readonly K_FACTOR_LOW_MATCHES = 40; // Débutants
```

---

## ✅ Checklist de Déploiement

- [ ] Tables Supabase créées
- [ ] Politiques RLS configurées
- [ ] Route `/rankings` ajoutée au layout
- [ ] Lien vers classements dans le menu
- [ ] Tests du live scoring effectués
- [ ] Tests du système de ranking effectués
- [ ] Notifications testées
- [ ] Documentation lue et comprise

---

## 🎉 Félicitations !

Vous avez maintenant un système complet de **Live Scoring** et **Classement Global** !

Vos utilisateurs peuvent :
- ✅ Suivre les matchs en temps réel
- ✅ Voir leur progression dans les classements
- ✅ Débloquer des achievements
- ✅ Gagner des badges
- ✅ Compétitionner avec d'autres joueurs
- ✅ Recevoir des notifications motivantes

**Bon jeu ! 🏆⚽🎯**
