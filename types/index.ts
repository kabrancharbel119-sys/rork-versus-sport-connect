export type Sport = 'football' | 'basketball' | 'volleyball' | 'tennis' | 'handball' | 'rugby' | 'badminton' | 'tabletennis' | 'cricket' | 'baseball' | 'hockey' | 'golf' | 'swimming' | 'athletics' | 'boxing' | 'mma' | 'wrestling' | 'judo' | 'karate' | 'taekwondo' | 'cycling' | 'skateboarding' | 'surfing' | 'climbing' | 'gymnastics' | 'esports' | 'futsal' | 'beachvolleyball' | 'padel' | 'squash';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type PlayStyle = 'competitive' | 'casual' | 'mixed';
export type Position = string;
export type UserRole = 'user' | 'admin' | 'venue_manager';

export type PaymentMethod = 'wave' | 'orange';
export type PaymentStatus = 'pending' | 'submitted' | 'approved' | 'rejected';
export type PayoutStatus = 'pending' | 'sent';
export type TournamentTeamStatus = 'pending_payment' | 'payment_submitted' | 'confirmed' | 'rejected' | 'cancelled';
export type PayoutRequestStatus = 'pending' | 'approved' | 'rejected';
export type PayoutPurposeCategory = 'venue' | 'referees' | 'logistics' | 'communication' | 'prize' | 'other';

// Mode de paiement configuré par le gestionnaire de terrain
export type VenuePaymentMode = 'in_app_immediate' | 'cash_off_app';
// Statut du paiement d'une réservation (indépendant du statut booking)
export type BookingPaymentStatus = 'not_required' | 'pending' | 'paid' | 'refunded' | 'failed';
// Statut de versement effectif d'une demande d'avance approuvée
export type DisbursementStatus = 'not_sent' | 'sent_to_venue' | 'sent_to_organizer';
// Types d'écriture du ledger des fonds tournoi
export type FundsLedgerEntryType = 'collection' | 'refund' | 'venue_advance' | 'logistics_advance' | 'platform_fee' | 'organizer_release';
// Litiges tournoi
export type DisputeSeverity = 'minor' | 'major';
export type DisputeStatus = 'open' | 'investigating' | 'resolved';
// Factures
export type InvoiceDocumentType = 'invoice' | 'credit_note' | 'payout_receipt';
export type InvoiceContextType = 'booking' | 'tournament_registration' | 'venue_advance' | 'logistics_advance' | 'organizer_release' | 'ticket_purchase';
export type InvoiceStatus = 'issued' | 'paid' | 'refunded' | 'cancelled';

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
  bannerImage?: string;
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
  isProfileVisible?: boolean;
  bannedUntil?: Date;
  banReason?: string;
  role: UserRole;
  /** Seuls les organisateurs certifiés (ou admin) peuvent créer des matchs classés */
  canCreateRankedMatches?: boolean;
  location?: UserLocation;
  createdAt: Date;
  availability: Availability[];
  // QR Code validation counters
  completedBookingsCount?: number;
  noShowCount?: number;
  memberSince?: Date;
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
  creatorId?: string; // ID du créateur de l'équipe (peut différer du capitaine actuel)
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
  role: 'captain' | 'co-captain' | 'member' | 'cm';
  position?: string;
  customRole?: string;
  joinedAt: Date;
}

// ════ CM (Community Manager) System ════

export interface CMPermissions {
  can_post: boolean;
  can_delete_posts: boolean;
  can_manage_photos: boolean;
  can_pin_posts: boolean;
}

export const DEFAULT_CM_PERMISSIONS: CMPermissions = {
  can_post: true,
  can_delete_posts: false,
  can_manage_photos: true,
  can_pin_posts: false,
};

export type CMStatus = 'active' | 'suspended';

export interface CMAssignment {
  id: string;
  teamId: string;
  userId: string;
  assignedBy: string;
  status: CMStatus;
  permissions: CMPermissions;
  assignedAt: Date;
  suspendedAt?: Date;
  suspendedReason?: string;
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

export interface TeamPhoto {
  id: string;
  teamId: string;
  userId: string;
  imageUrl: string;
  caption?: string;
  createdAt: Date;
}

export interface Match {
  id: string;
  sport: Sport;
  format: string;
  type: 'friendly' | 'ranked' | 'tournament';
  status: 'venue_pending' | 'open' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
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
  /** Id du tournoi si match de tournoi */
  tournamentId?: string;
  /** Phase / round (ex: "Poule A", "Quart 1", "Demi-finale", "Finale") */
  roundLabel?: string;
  hasTickets?: boolean;
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

export interface VenueOpeningHours {
  dayOfWeek: number; // 0=Dimanche, 1=Lundi, ..., 6=Samedi
  openTime: string;  // "08:00"
  closeTime: string; // "22:00"
  isClosed: boolean;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  sport: Sport[];
  pricePerHour: number;
  images?: string[];
  rating: number;
  amenities: string[];
  coordinates?: { latitude: number; longitude: number };
  ownerId?: string;
  description?: string;
  phone?: string;
  email?: string;
  openingHours?: VenueOpeningHours[];
  autoApprove?: boolean;
  isActive?: boolean;
  capacity?: number;
  surfaceType?: string;
  rules?: string;
  cancellationHours?: number;
  paymentMode?: VenuePaymentMode;
  payoutPhone?: string;
}

export interface VenueReview {
  id: string;
  venueId: string;
  userId: string;
  rating: number;
  comment?: string;
  authorName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'rejected' | 'completed';

export interface Booking {
  id: string;
  venueId: string;
  venue?: Venue;
  userId: string;
  user?: User;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: BookingStatus;
  matchId?: string;
  tournamentId?: string;
  notes?: string;
  createdAt: Date;
  bookingCode?: string;
  // QR Code validation fields
  checkInToken?: string;
  validatedAt?: Date;
  validatedBy?: string;
  // Paiement in-app
  paymentStatus?: BookingPaymentStatus;
  paymentTransactionId?: string;
  paidAt?: Date;
}

// ============================================
// BILLETTERIE
// ============================================

export type TicketEventType = 'match' | 'tournament';
export type TicketStatus = 'pending_payment' | 'valid' | 'used' | 'cancelled' | 'refunded';

export interface TicketType {
  id: string;
  eventType: TicketEventType;
  eventId: string;
  name: string;
  description?: string;
  price: number;
  quantityTotal: number;
  quantitySold: number;
  salesStart?: Date;
  salesEnd?: Date;
  maxPerUser: number;
  isActive: boolean;
  validDays?: string[] | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  ticketTypeId: string;
  ticketType?: TicketType;
  eventType: TicketEventType;
  eventId: string;
  buyerId: string;
  holderName?: string;
  pricePaid: number;
  status: TicketStatus;
  ticketCode: string;
  qrToken: string;
  paymentTransactionId?: string;
  purchasedAt: Date;
  paidAt?: Date;
  usedAt?: Date;
  validatedBy?: string;
  cancelledAt?: Date;
  createdAt: Date;
  eventInfo?: {
    name: string;
    date: string;
    location?: string;
    sport?: string;
  };
}

export interface TicketSalesStats {
  totalSold: number;
  totalUsed: number;
  totalRevenue: number;
  byType: {
    ticketTypeId: string;
    name: string;
    sold: number;
    total: number;
    used: number;
    revenue: number;
  }[];
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  sport: Sport;
  format: string;
  type: 'knockout' | 'league' | 'group_knockout';
  status: 'registration' | 'in_progress' | 'completed' | 'venue_pending' | 'cancelled';
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
  bannerImage?: string;
  managers?: string[];
  createdBy: string;
  createdAt: Date;
  isDemo?: boolean;
  entryPaymentMode?: VenuePaymentMode;
  hasTickets?: boolean;
}

export type CancellationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TournamentCancellationRequest {
  id: string;
  tournamentId: string;
  organizerId: string;
  reason: string;
  status: CancellationRequestStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  adminNote?: string;
  organizerResponse?: string;
  internalComment?: string;
  refundProcessed: boolean;
  refundAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentPayment {
  id: string;
  tournamentId: string;
  teamId: string;
  amount: number;
  method: PaymentMethod;
  receiver: string;
  status: PaymentStatus;
  screenshotUrl?: string;
  transactionRef?: string;
  expectedSenderName?: string;
  validatedBy?: string;
  createdAt: Date;
  validatedAt?: Date;
  paymentDeadline?: Date;
  payoutStatus: PayoutStatus;
  organizerAmount: number;
  platformFee: number;
}

export interface PaymentLog {
  id: string;
  paymentId: string;
  action: string;
  performedBy?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  teamId: string;
  status: TournamentTeamStatus;
  registeredAt: Date;
  confirmedAt?: Date;
  team?: Team;
  payment?: TournamentPayment;
}

export interface TournamentPayoutRequest {
  id: string;
  tournamentId: string;
  organizerId: string;
  requestedAmount: number;
  purposeCategory: PayoutPurposeCategory;
  reason: string;
  useOfFunds: string;
  budgetBreakdown: string;
  amountAlreadySpent: number;
  neededBy?: Date;
  supportingEvidence?: string;
  fallbackContact?: string;
  urgency: 'low' | 'medium' | 'high';
  payoutPhone: string;
  status: PayoutRequestStatus;
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Avance terrain fléchée + suivi de versement
  venueId?: string;
  disbursementStatus?: DisbursementStatus;
  disbursedAt?: Date;
  disbursementTransactionId?: string;
}

export interface TournamentFundsLedgerEntry {
  id: string;
  tournamentId: string;
  entryType: FundsLedgerEntryType;
  amount: number; // positif = entrée, négatif = sortie (FCFA)
  referenceType?: string;
  referenceId?: string;
  performedBy?: string;
  note?: string;
  createdAt: Date;
}

export interface TournamentFundsSummary {
  tournamentId: string;
  netCollected: number;
  totalAdvanced: number;
  availableForLogisticsAdvance: number;
  fillRatePercent: number;
  canReleaseOrganizerFunds: boolean;
}

export interface TournamentDispute {
  id: string;
  tournamentId: string;
  reportedBy: string;
  severity: DisputeSeverity;
  reason: string;
  status: DisputeStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  documentType: InvoiceDocumentType;
  contextType: InvoiceContextType;
  contextId: string;
  amount: number;
  currency: string;
  payerId?: string;
  beneficiaryId?: string;
  description: string;
  paymentMethod?: string;
  paymentTransactionId?: string;
  status: InvoiceStatus;
  issuedAt: Date;
  paidAt?: Date;
  metadata?: Record<string, any>;
  payerName?: string;
  payeeName?: string;
  eventName?: string;
  eventType?: string;
  eventId?: string;
  reason?: string;
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
  type: 'match' | 'team' | 'tournament' | 'chat' | 'system' | 'booking' | 'social';
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

// =============================================
// SOCIAL FEED TYPES
// =============================================
export type AutoPostType = 'match_created' | 'match_won' | 'tournament_won' | 'team_joined' | 'team_created' | 'venue_created' | 'tournament_created';

export interface Post {
  id: string;
  authorId: string;
  content: string;
  images: string[];
  sportTag?: string;
  teamTag?: string;
  matchTag?: string;
  tournamentTag?: string;
  isAutoGenerated: boolean;
  autoType?: AutoPostType;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  // Joined author fields
  authorUsername?: string;
  authorFullName?: string;
  authorAvatar?: string;
  authorIsVerified?: boolean;
  // Client-side: has current user liked this post
  hasLiked?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  createdAt: Date;
  // Joined user fields
  username?: string;
  fullName?: string;
  avatar?: string;
}

// =============================================
// TEAM FEED TYPES
// =============================================
export interface TeamPost {
  id: string;
  teamId: string;
  authorId: string;
  content: string;
  images: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  // Joined team fields
  teamName?: string;
  teamLogo?: string;
  // Joined author fields
  authorUsername?: string;
  authorFullName?: string;
  authorAvatar?: string;
  authorRole?: string;
  hasLiked?: boolean;
}

export interface TeamPostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  createdAt: Date;
  username?: string;
  fullName?: string;
  avatar?: string;
}
