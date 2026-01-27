export type Sport = 'football' | 'basketball' | 'volleyball' | 'tennis' | 'handball' | 'rugby' | 'badminton' | 'tabletennis' | 'cricket' | 'baseball' | 'hockey' | 'golf' | 'swimming' | 'athletics' | 'boxing' | 'mma' | 'wrestling' | 'judo' | 'karate' | 'taekwondo' | 'cycling' | 'skateboarding' | 'surfing' | 'climbing' | 'gymnastics' | 'esports' | 'futsal' | 'beachvolleyball' | 'padel' | 'squash';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type PlayStyle = 'competitive' | 'casual' | 'mixed';
export type Position = string;
export type UserRole = 'user' | 'admin';

export const DEFAULT_ROLES = ['Capitaine', 'Co-Capitaine', 'Coach', 'Gardien', 'Défenseur', 'Milieu', 'Attaquant', 'Ailier', 'Pivot', 'Meneur', 'Arrière', 'Libero', 'Passeur', 'Central', 'Remplaçant'] as const;

export interface UserLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  lastUpdated: Date;
}

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar?: string;
  phone?: string;
  city?: string;
  country?: string;
  bio?: string;
  sports: UserSport[];
  stats: UserStats;
  reputation: number;
  walletBalance: number;
  teams: string[];
  followers: number;
  following: number;
  isVerified: boolean;
  isPremium: boolean;
  isBanned: boolean;
  role: UserRole;
  /** Seuls les organisateurs certifiés (ou admin) peuvent créer des matchs classés */
  canCreateRankedMatches?: boolean;
  location?: UserLocation;
  createdAt: Date;
  availability: Availability[];
}

export interface UserSport {
  sport: Sport;
  level: SkillLevel;
  position?: string;
  yearsPlaying: number;
}

export interface UserStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  assists: number;
  mvpAwards: number;
  fairPlayScore: number;
  tournamentWins: number;
  totalCashPrize: number;
}

export interface Availability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TeamRole {
  id: string;
  name: string;
  isCustom: boolean;
  createdBy?: string;
}

export interface Team {
  id: string;
  name: string;
  logo?: string;
  sport: Sport;
  format: string;
  level: SkillLevel;
  ambiance: PlayStyle;
  city: string;
  country: string;
  description?: string;
  captainId: string;
  coCaptainIds: string[];
  members: TeamMember[];
  fans: string[]; // IDs des fans/abonnés (pas de membres, juste abonnés)
  maxMembers: number;
  stats: TeamStats;
  reputation: number;
  isRecruiting: boolean;
  joinRequests: JoinRequest[];
  customRoles: TeamRole[];
  location?: UserLocation;
  createdAt: Date;
}

export interface TeamMember {
  userId: string;
  user?: User;
  role: 'captain' | 'co-captain' | 'member';
  position?: string;
  customRole?: string;
  joinedAt: Date;
}

export interface TeamStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  tournamentWins: number;
  totalCashPrize: number;
}

export interface JoinRequest {
  id: string;
  userId: string;
  user?: User;
  teamId: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'waiting';
  compatibilityScore?: number;
  createdAt: Date;
  respondedAt?: Date;
}

export interface Match {
  id: string;
  sport: Sport;
  format: string;
  type: 'friendly' | 'ranked' | 'tournament';
  status: 'open' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  homeTeam?: Team;
  homeTeamId?: string;
  awayTeam?: Team;
  awayTeamId?: string;
  venue: Venue;
  dateTime: Date;
  duration: number;
  level: SkillLevel;
  ambiance: PlayStyle;
  maxPlayers: number;
  registeredPlayers: string[];
  score?: MatchScore;
  mvpId?: string;
  createdBy: string;
  entryFee?: number;
  prize?: number;
  needsPlayers: boolean;
  location?: UserLocation;
  playerStats?: MatchPlayerStats[];
  createdAt: Date;
}

export interface MatchPlayerStats {
  userId: string;
  goals: number;
  assists: number;
  mvp: boolean;
  fairPlay: number;
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  sport: Sport[];
  pricePerHour: number;
  images?: string[];
  rating: number;
  amenities: string[];
  coordinates?: { latitude: number; longitude: number };
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  sport: Sport;
  format: string;
  type: 'knockout' | 'league' | 'group_knockout';
  status: 'registration' | 'in_progress' | 'completed';
  level: SkillLevel;
  maxTeams: number;
  registeredTeams: string[];
  entryFee: number;
  prizePool: number;
  prizes: TournamentPrize[];
  venue: Venue;
  startDate: Date;
  endDate: Date;
  matches: Match[];
  winnerId?: string;
  sponsorName?: string;
  sponsorLogo?: string;
  createdBy: string;
  createdAt: Date;
}

export interface TournamentPrize {
  position: number;
  amount: number;
  label: string;
}

export interface ChatRoom {
  id: string;
  teamId?: string; // Optionnel pour les conversations directes
  name: string;
  type: 'general' | 'match' | 'strategy' | 'direct';
  lastMessage?: ChatMessage;
  unreadCount: number;
  participants: string[];
  createdAt: Date;
}

export interface ChatRequest {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message?: string;
  createdAt: Date;
  respondedAt?: Date;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender?: User;
  content: string;
  type: 'text' | 'image' | 'video' | 'system';
  mentions?: string[];
  createdAt: Date;
  readBy: string[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'match' | 'team' | 'tournament' | 'chat' | 'system';
  title: string;
  message: string;
  data?: Record<string, string>;
  isRead: boolean;
  createdAt: Date;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'prize' | 'entry_fee' | 'refund';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

export interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  totalMatches: number;
  totalTournaments: number;
  activeUsers: number;
  pendingReports: number;
}
