import { User, Team, Match, Tournament, Venue, ChatRoom, ChatMessage, Sport } from '@/types';

export const mockUser: User = {
  id: 'user-1',
  email: 'kouame.yao@email.com',
  username: 'kouame_yao',
  fullName: 'Kouamé Yao',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
  phone: '+225 07 00 00 00',
  city: 'Abidjan',
  country: 'Côte d\'Ivoire',
  bio: 'Passionné de football depuis 15 ans. Capitaine de l\'équipe FC Cocody.',
  sports: [
    { sport: 'football', level: 'advanced', position: 'Milieu', yearsPlaying: 15 },
    { sport: 'basketball', level: 'intermediate', position: 'Ailier', yearsPlaying: 5 },
  ],
  stats: { matchesPlayed: 156, wins: 89, losses: 42, draws: 25, goalsScored: 67, assists: 45, mvpAwards: 12, fairPlayScore: 4.8, tournamentWins: 5, totalCashPrize: 450000 },
  reputation: 4.8,
  walletBalance: 125000,
  teams: ['team-1', 'team-2'],
  followers: 234,
  following: 156,
  isVerified: true,
  isPremium: true,
  isBanned: false,
  role: 'user',
  location: { latitude: 5.3599, longitude: -4.0083, city: 'Abidjan', country: 'Côte d\'Ivoire', lastUpdated: new Date() },
  createdAt: new Date('2023-01-15'),
  availability: [{ dayOfWeek: 6, startTime: '14:00', endTime: '18:00' }, { dayOfWeek: 0, startTime: '09:00', endTime: '12:00' }],
};

export const mockAdminUser: User = {
  id: 'admin-1',
  email: 'admin@versus.com',
  username: 'vs_admin',
  fullName: 'Admin VS',
  phone: '+225 00 00 00 00',
  city: 'Abidjan',
  country: 'Côte d\'Ivoire',
  bio: 'Administrateur de la plateforme VS',
  sports: [],
  stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, goalsScored: 0, assists: 0, mvpAwards: 0, fairPlayScore: 5.0, tournamentWins: 0, totalCashPrize: 0 },
  reputation: 5.0,
  walletBalance: 0,
  teams: [],
  followers: 0,
  following: 0,
  isVerified: true,
  isPremium: true,
  isBanned: false,
  role: 'admin',
  createdAt: new Date('2023-01-01'),
  availability: [],
};

export const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'FC Cocody',
    logo: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=200&h=200&fit=crop',
    sport: 'football',
    format: '11v11',
    level: 'advanced',
    ambiance: 'competitive',
    city: 'Abidjan',
    country: 'Côte d\'Ivoire',
    description: 'Équipe compétitive basée à Cocody.',
    captainId: 'user-1',
    coCaptainIds: ['user-2'],
    members: [
      { userId: 'user-1', role: 'captain', position: 'Milieu', customRole: 'Capitaine', joinedAt: new Date('2023-01-15') },
      { userId: 'user-2', role: 'co-captain', position: 'Défenseur', customRole: 'Co-Capitaine', joinedAt: new Date('2023-02-01') },
      { userId: 'user-3', role: 'member', position: 'Attaquant', joinedAt: new Date('2023-03-10') },
    ],
    maxMembers: 20,
    stats: { matchesPlayed: 45, wins: 28, losses: 10, draws: 7, goalsFor: 89, goalsAgainst: 42, tournamentWins: 3, totalCashPrize: 750000 },
    reputation: 4.7,
    isRecruiting: true,
    joinRequests: [],
    customRoles: [{ id: 'role-1', name: 'Stratège', isCustom: true, createdBy: 'user-1' }],
    location: { latitude: 5.3599, longitude: -4.0083, city: 'Abidjan', country: 'Côte d\'Ivoire', lastUpdated: new Date() },
    createdAt: new Date('2023-01-15'),
  },
  {
    id: 'team-2',
    name: 'Riviera Stars',
    logo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200&h=200&fit=crop',
    sport: 'football',
    format: '5v5',
    level: 'intermediate',
    ambiance: 'mixed',
    city: 'Abidjan',
    country: 'Côte d\'Ivoire',
    description: 'Équipe amicale pour matchs du weekend.',
    captainId: 'user-4',
    coCaptainIds: [],
    members: [
      { userId: 'user-4', role: 'captain', position: 'Gardien', joinedAt: new Date('2023-05-01') },
      { userId: 'user-1', role: 'member', position: 'Milieu', joinedAt: new Date('2023-06-15') },
    ],
    maxMembers: 10,
    stats: { matchesPlayed: 22, wins: 12, losses: 6, draws: 4, goalsFor: 45, goalsAgainst: 30, tournamentWins: 1, totalCashPrize: 150000 },
    reputation: 4.3,
    isRecruiting: true,
    joinRequests: [],
    customRoles: [],
    createdAt: new Date('2023-05-01'),
  },
];

export const mockVenues: Venue[] = [
  { id: 'venue-1', name: 'Stade Félix Houphouët-Boigny', address: 'Boulevard de la République, Plateau', city: 'Abidjan', sport: ['football'], pricePerHour: 50000, images: ['https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800'], rating: 4.8, amenities: ['Vestiaires', 'Parking', 'Éclairage', 'Tribunes'], coordinates: { latitude: 5.3167, longitude: -4.0333 } },
  { id: 'venue-2', name: 'Terrain de Cocody', address: 'Rue des Sports, Cocody', city: 'Abidjan', sport: ['football', 'basketball'], pricePerHour: 25000, images: ['https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'], rating: 4.2, amenities: ['Vestiaires', 'Parking'], coordinates: { latitude: 5.3599, longitude: -4.0083 } },
  { id: 'venue-3', name: 'Complexe Sportif de Marcory', address: 'Avenue Pierre Fakhoury, Marcory', city: 'Abidjan', sport: ['football', 'basketball', 'volleyball'], pricePerHour: 35000, images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800'], rating: 4.5, amenities: ['Vestiaires', 'Parking', 'Éclairage', 'Cafétéria'], coordinates: { latitude: 5.3000, longitude: -3.9833 } },
  { id: 'venue-4', name: 'Terrain Municipal Yopougon', address: 'Boulevard Principal, Yopougon', city: 'Abidjan', sport: ['football'], pricePerHour: 15000, images: ['https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800'], rating: 3.8, amenities: ['Vestiaires', 'Éclairage'], coordinates: { latitude: 5.3500, longitude: -4.0833 } },
  { id: 'venue-5', name: 'Palais des Sports de Treichville', address: 'Rue 12, Treichville', city: 'Abidjan', sport: ['basketball', 'volleyball', 'handball'], pricePerHour: 45000, images: ['https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800'], rating: 4.6, amenities: ['Vestiaires', 'Parking', 'Climatisation', 'Tribunes', 'Sono'], coordinates: { latitude: 5.3000, longitude: -4.0167 } },
  { id: 'venue-6', name: 'Tennis Club Ivoire', address: 'Rue des Jardins, Deux Plateaux', city: 'Abidjan', sport: ['tennis', 'padel'], pricePerHour: 20000, images: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800'], rating: 4.4, amenities: ['Vestiaires', 'Parking', 'Pro Shop', 'Restaurant'], coordinates: { latitude: 5.3700, longitude: -4.0200 } },
  { id: 'venue-7', name: 'Stade Robert Champroux', address: 'Boulevard Latrille, Cocody', city: 'Abidjan', sport: ['football', 'athletics'], pricePerHour: 40000, images: ['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800'], rating: 4.3, amenities: ['Vestiaires', 'Parking', 'Éclairage', 'Piste d\'athlétisme'], coordinates: { latitude: 5.3650, longitude: -4.0050 } },
  { id: 'venue-8', name: 'Centre Aquatique Olympique', address: 'Zone 4, Marcory', city: 'Abidjan', sport: ['swimming'], pricePerHour: 30000, images: ['https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800'], rating: 4.7, amenities: ['Vestiaires', 'Parking', 'Sauna', 'Coach disponible'], coordinates: { latitude: 5.3100, longitude: -3.9900 } },
  { id: 'venue-9', name: 'Gymnase de Koumassi', address: 'Avenue 13, Koumassi', city: 'Abidjan', sport: ['basketball', 'volleyball', 'handball', 'badminton'], pricePerHour: 20000, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'], rating: 4.0, amenities: ['Vestiaires', 'Parking'], coordinates: { latitude: 5.2900, longitude: -3.9500 } },
  { id: 'venue-10', name: 'City Padel Abidjan', address: 'Riviera 3, Cocody', city: 'Abidjan', sport: ['padel', 'tennis'], pricePerHour: 25000, images: ['https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=800'], rating: 4.8, amenities: ['Vestiaires', 'Parking', 'Bar', 'Location matériel'], coordinates: { latitude: 5.3750, longitude: -3.9800 } },
  { id: 'venue-11', name: 'Stade de Bouaké', address: 'Avenue de la Paix', city: 'Bouaké', sport: ['football'], pricePerHour: 30000, images: ['https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800'], rating: 4.1, amenities: ['Vestiaires', 'Parking', 'Éclairage'], coordinates: { latitude: 7.6833, longitude: -5.0333 } },
  { id: 'venue-12', name: 'Complexe Sportif San Pedro', address: 'Zone Industrielle', city: 'San Pedro', sport: ['football', 'basketball'], pricePerHour: 25000, images: ['https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800'], rating: 4.0, amenities: ['Vestiaires', 'Parking'], coordinates: { latitude: 4.7500, longitude: -6.6333 } },
];

export const mockMatches: Match[] = [
  { id: 'match-1', sport: 'football', format: '5v5', type: 'friendly', status: 'open', homeTeamId: 'team-1', venue: mockVenues[1], dateTime: new Date('2026-01-25T15:00:00'), duration: 90, level: 'advanced', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: ['user-1', 'user-2', 'user-3'], createdBy: 'user-1', needsPlayers: true, location: { latitude: 5.3599, longitude: -4.0083, city: 'Abidjan', country: 'Côte d\'Ivoire', lastUpdated: new Date() }, createdAt: new Date() },
  { id: 'match-2', sport: 'football', format: '11v11', type: 'ranked', status: 'confirmed', homeTeamId: 'team-1', awayTeamId: 'team-2', venue: mockVenues[0], dateTime: new Date('2026-01-28T16:00:00'), duration: 90, level: 'advanced', ambiance: 'competitive', maxPlayers: 22, registeredPlayers: [], createdBy: 'user-1', entryFee: 10000, prize: 100000, needsPlayers: false, createdAt: new Date() },
];

export const mockTournaments: Tournament[] = [
  { id: 'tournament-1', name: 'Coupe de Cocody 2026', description: 'Le plus grand tournoi amateur de Cocody.', sport: 'football', format: '11v11', type: 'knockout', status: 'registration', level: 'advanced', maxTeams: 16, registeredTeams: ['team-1', 'team-2'], entryFee: 50000, prizePool: 500000, prizes: [{ position: 1, amount: 300000, label: '1er' }, { position: 2, amount: 150000, label: '2ème' }, { position: 3, amount: 50000, label: '3ème' }], venue: mockVenues[0], startDate: new Date('2026-02-15'), endDate: new Date('2026-02-28'), matches: [], sponsorName: 'Orange CI', createdBy: 'user-1', createdAt: new Date() },
];

export const mockChatRooms: ChatRoom[] = [
  { id: 'chat-1', teamId: 'team-1', name: 'FC Cocody - Général', type: 'general', lastMessage: { id: 'msg-1', roomId: 'chat-1', senderId: 'user-2', content: 'Prêts pour le match de samedi ?', type: 'text', createdAt: new Date(), readBy: ['user-1'] }, unreadCount: 2, participants: ['user-1', 'user-2', 'user-3'], createdAt: new Date() },
  { id: 'chat-2', teamId: 'team-1', name: 'Stratégie - Coupe Cocody', type: 'strategy', lastMessage: { id: 'msg-2', roomId: 'chat-2', senderId: 'user-1', content: 'J\'ai préparé la composition', type: 'text', createdAt: new Date(), readBy: [] }, unreadCount: 0, participants: ['user-1', 'user-2'], createdAt: new Date() },
];

export const mockMessages: ChatMessage[] = [
  { id: 'msg-1', roomId: 'chat-1', senderId: 'user-2', content: 'Salut l\'équipe !', type: 'text', createdAt: new Date(Date.now() - 3600000), readBy: ['user-1', 'user-3'] },
  { id: 'msg-2', roomId: 'chat-1', senderId: 'user-1', content: 'Salut ! On se retrouve à 14h samedi ?', type: 'text', createdAt: new Date(Date.now() - 1800000), readBy: ['user-2', 'user-3'] },
  { id: 'msg-3', roomId: 'chat-1', senderId: 'user-3', content: 'Parfait pour moi !', type: 'text', createdAt: new Date(Date.now() - 900000), readBy: ['user-1', 'user-2'] },
  { id: 'msg-4', roomId: 'chat-1', senderId: 'user-2', content: 'Prêts pour le match de samedi ?', type: 'text', createdAt: new Date(), readBy: ['user-1'] },
];

export const ALL_SPORTS: Sport[] = ['football', 'basketball', 'volleyball', 'tennis', 'handball', 'rugby', 'badminton', 'tabletennis', 'cricket', 'baseball', 'hockey', 'golf', 'swimming', 'athletics', 'boxing', 'mma', 'wrestling', 'judo', 'karate', 'taekwondo', 'cycling', 'skateboarding', 'surfing', 'climbing', 'gymnastics', 'esports', 'futsal', 'beachvolleyball', 'padel', 'squash'];

export const sportLabels: Record<string, string> = {
  football: 'Football', basketball: 'Basketball', volleyball: 'Volleyball', tennis: 'Tennis', handball: 'Handball', rugby: 'Rugby', badminton: 'Badminton', tabletennis: 'Tennis de table', cricket: 'Cricket', baseball: 'Baseball', hockey: 'Hockey', golf: 'Golf', swimming: 'Natation', athletics: 'Athlétisme', boxing: 'Boxe', mma: 'MMA', wrestling: 'Lutte', judo: 'Judo', karate: 'Karaté', taekwondo: 'Taekwondo', cycling: 'Cyclisme', skateboarding: 'Skateboard', surfing: 'Surf', climbing: 'Escalade', gymnastics: 'Gymnastique', esports: 'E-sports', futsal: 'Futsal', beachvolleyball: 'Beach-volley', padel: 'Padel', squash: 'Squash',
};

export const levelLabels: Record<string, string> = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', expert: 'Expert' };
export const ambianceLabels: Record<string, string> = { competitive: 'Compétitif', casual: 'Détente', mixed: 'Mixte' };

export const DEFAULT_POSITIONS: Record<string, string[]> = {
  football: ['Gardien', 'Défenseur', 'Milieu', 'Attaquant', 'Ailier'],
  basketball: ['Meneur', 'Arrière', 'Ailier', 'Ailier fort', 'Pivot'],
  volleyball: ['Passeur', 'Central', 'Attaquant', 'Libero', 'Réceptionneur'],
  handball: ['Gardien', 'Arrière', 'Ailier', 'Demi-centre', 'Pivot'],
  rugby: ['Pilier', 'Talonneur', 'Deuxième ligne', 'Troisième ligne', 'Demi de mêlée', 'Demi d\'ouverture', 'Centre', 'Ailier', 'Arrière'],
  tennis: ['Simple', 'Double'],
  default: ['Joueur', 'Remplaçant'],
};

export const TEAM_ROLES = ['Capitaine', 'Co-Capitaine', 'Coach', 'Manager', 'Entraîneur adjoint', 'Préparateur physique', 'Médecin', 'Analyste'] as const;
