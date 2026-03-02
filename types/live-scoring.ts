// Types pour le système de Live Scoring
export type MatchEventType = 
  | 'goal' 
  | 'yellow_card' 
  | 'red_card' 
  | 'substitution' 
  | 'penalty' 
  | 'own_goal'
  | 'assist'
  | 'save'
  | 'injury'
  | 'timeout'
  | 'period_start'
  | 'period_end'
  | 'match_start'
  | 'match_end';

export type MatchPeriod = 'first_half' | 'second_half' | 'extra_time_first' | 'extra_time_second' | 'penalties';

export interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  timestamp: Date;
  minute: number;
  period: MatchPeriod;
  teamId: string;
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  description?: string;
  metadata?: {
    // Pour les buts
    goalType?: 'open_play' | 'penalty' | 'free_kick' | 'header' | 'own_goal';
    bodyPart?: 'right_foot' | 'left_foot' | 'head' | 'chest' | 'other';
    
    // Pour les cartons
    cardReason?: string;
    
    // Pour les remplacements
    playerOutId?: string;
    playerOutName?: string;
    
    // Pour les blessures
    injuryType?: string;
    returnExpected?: boolean;
    
    // Coordonnées sur le terrain (optionnel)
    positionX?: number;
    positionY?: number;
  };
  createdBy: string;
  createdAt: Date;
}

export interface LiveMatchStats {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  currentPeriod: MatchPeriod;
  currentMinute: number;
  isLive: boolean;
  startedAt?: Date;
  
  // Statistiques détaillées
  stats: {
    home: TeamLiveStats;
    away: TeamLiveStats;
  };
  
  // Timeline des événements
  events: MatchEvent[];
  
  // Dernière mise à jour
  lastUpdate: Date;
}

export interface TeamLiveStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  possession: number; // Pourcentage
  passes: number;
  passesCompleted: number;
  fouls: number;
  corners: number;
  offsides: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  
  // Statistiques par joueur
  playerStats: PlayerLiveStats[];
}

export interface PlayerLiveStats {
  playerId: string;
  playerName: string;
  position?: string;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  rating?: number; // Note du joueur (0-10)
}

export interface LiveScoringNotification {
  id: string;
  matchId: string;
  eventType: MatchEventType;
  title: string;
  message: string;
  timestamp: Date;
  data: {
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    score: string;
    event: MatchEvent;
  };
}

export interface MatchCommentary {
  id: string;
  matchId: string;
  minute: number;
  period: MatchPeriod;
  text: string;
  isImportant: boolean;
  timestamp: Date;
}
