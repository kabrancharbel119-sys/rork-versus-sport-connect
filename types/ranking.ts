// Types pour le système de Classement Global
import { Sport } from './index';

export type RankingCategory = 'global' | 'sport' | 'city' | 'team';
export type RankingPeriod = 'all_time' | 'season' | 'month' | 'week';

export interface PlayerRanking {
  userId: string;
  username: string;
  fullName?: string;
  avatar?: string;
  city?: string;
  
  // Classement ELO
  eloRating: number;
  previousEloRating: number;
  eloChange: number;
  
  // Position dans le classement
  rank: number;
  previousRank: number;
  rankChange: number;
  
  // Statistiques globales
  stats: PlayerRankingStats;
  
  // Par sport
  sportRankings: Record<Sport, SportRanking>;
  
  // Achievements
  achievements: Achievement[];
  badges: Badge[];
  
  // Dernière mise à jour
  lastMatchDate?: Date;
  updatedAt: Date;
}

export interface PlayerRankingStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // Pourcentage
  
  // Statistiques de performance
  totalGoals: number;
  totalAssists: number;
  averageRating: number;
  
  // Streaks
  currentWinStreak: number;
  longestWinStreak: number;
  currentLossStreak: number;
  
  // Matchs classés
  rankedMatches: number;
  rankedWins: number;
  rankedLosses: number;
  
  // Performance récente (derniers 10 matchs)
  recentForm: ('W' | 'L' | 'D')[];
  recentPerformance: number; // Score de performance 0-100
}

export interface SportRanking {
  sport: Sport;
  eloRating: number;
  rank: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  goals: number;
  assists: number;
  averageRating: number;
}

export interface TeamRanking {
  teamId: string;
  teamName: string;
  logo?: string;
  sport: Sport;
  city?: string;
  
  // Classement ELO
  eloRating: number;
  previousEloRating: number;
  eloChange: number;
  
  // Position
  rank: number;
  previousRank: number;
  rankChange: number;
  
  // Statistiques
  stats: TeamRankingStats;
  
  // Dernière mise à jour
  lastMatchDate?: Date;
  updatedAt: Date;
}

export interface TeamRankingStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  
  cleanSheets: number;
  
  currentWinStreak: number;
  longestWinStreak: number;
  
  recentForm: ('W' | 'L' | 'D')[];
}

export interface Achievement {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: Date;
  progress?: number;
  maxProgress?: number;
}

export type AchievementType =
  | 'first_win'
  | 'win_streak_5'
  | 'win_streak_10'
  | 'win_streak_20'
  | 'goals_10'
  | 'goals_50'
  | 'goals_100'
  | 'assists_10'
  | 'assists_50'
  | 'matches_10'
  | 'matches_50'
  | 'matches_100'
  | 'top_10_global'
  | 'top_10_city'
  | 'top_10_sport'
  | 'elo_1500'
  | 'elo_1800'
  | 'elo_2000'
  | 'perfect_month'
  | 'comeback_king'
  | 'clean_sheet_master'
  | 'hat_trick'
  | 'mvp_10'
  | 'tournament_winner';

export interface Badge {
  id: string;
  type: BadgeType;
  name: string;
  icon: string;
  color: string;
  earnedAt: Date;
}

export type BadgeType =
  | 'top_1_global'
  | 'top_10_global'
  | 'top_100_global'
  | 'top_1_city'
  | 'top_10_city'
  | 'top_1_sport'
  | 'elite_player'
  | 'rising_star'
  | 'veteran'
  | 'goal_machine'
  | 'playmaker'
  | 'defensive_wall'
  | 'consistent_performer';

export interface RankingHistory {
  userId: string;
  date: Date;
  eloRating: number;
  rank: number;
  matchesPlayed: number;
}

export interface Leaderboard {
  category: RankingCategory;
  period: RankingPeriod;
  sport?: Sport;
  city?: string;
  
  // Classement des joueurs
  players: PlayerRanking[];
  
  // Classement des équipes
  teams?: TeamRanking[];
  
  // Métadonnées
  totalPlayers: number;
  lastUpdate: Date;
}

export interface EloCalculation {
  playerElo: number;
  opponentElo: number;
  result: 'win' | 'loss' | 'draw';
  kFactor: number;
  expectedScore: number;
  actualScore: number;
  eloChange: number;
  newElo: number;
}

export interface RankingUpdate {
  userId: string;
  matchId: string;
  oldElo: number;
  newElo: number;
  eloChange: number;
  oldRank: number;
  newRank: number;
  rankChange: number;
  achievementsUnlocked: Achievement[];
  badgesEarned: Badge[];
  timestamp: Date;
}
