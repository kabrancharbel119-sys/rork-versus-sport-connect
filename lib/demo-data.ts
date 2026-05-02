import type { Match } from '@/types';

export const DEMO_TOURNAMENT_ID = 'a0000000-0000-0000-0000-000000000001';

const D = (daysAgo: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const VENUE = { id: '', name: 'Terrain Central', address: 'Avenue du Sport', city: 'Dakar', sport: [] as any[], pricePerHour: 0, rating: 0, amenities: [] as string[] };

export const DEMO_TEAMS: { id: string; name: string }[] = [
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Lions FC' },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Eagles United' },
  { id: 'b0000000-0000-0000-0000-000000000003', name: 'Warriors SC' },
  { id: 'b0000000-0000-0000-0000-000000000004', name: 'Sharks FC' },
  { id: 'b0000000-0000-0000-0000-000000000005', name: 'Bulls Team' },
  { id: 'b0000000-0000-0000-0000-000000000006', name: 'Tigers FC' },
  { id: 'b0000000-0000-0000-0000-000000000007', name: 'Hawks United' },
  { id: 'b0000000-0000-0000-0000-000000000008', name: 'Wolves SC' },
];

const [t1, t2, t3, t4, t5, t6, t7, t8] = DEMO_TEAMS.map(t => t.id);

export const DEMO_MATCHES: Match[] = [
  { id: 'c0000000-0000-0000-0000-000000000001', sport: 'football', format: '5v5', type: 'tournament', status: 'completed', dateTime: D(25, 10), duration: 90, level: 'intermediate', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: [], needsPlayers: false, homeTeamId: t1, awayTeamId: t8, score: { home: 3, away: 1 }, tournamentId: DEMO_TOURNAMENT_ID, roundLabel: 'Quart de finale', venue: VENUE, createdBy: '', createdAt: D(30, 0) },
  { id: 'c0000000-0000-0000-0000-000000000002', sport: 'football', format: '5v5', type: 'tournament', status: 'completed', dateTime: D(25, 12), duration: 90, level: 'intermediate', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: [], needsPlayers: false, homeTeamId: t2, awayTeamId: t6, score: { home: 2, away: 0 }, tournamentId: DEMO_TOURNAMENT_ID, roundLabel: 'Quart de finale', venue: VENUE, createdBy: '', createdAt: D(30, 0) },
  { id: 'c0000000-0000-0000-0000-000000000003', sport: 'football', format: '5v5', type: 'tournament', status: 'completed', dateTime: D(24, 10), duration: 90, level: 'intermediate', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: [], needsPlayers: false, homeTeamId: t3, awayTeamId: t7, score: { home: 1, away: 1 }, tournamentId: DEMO_TOURNAMENT_ID, roundLabel: 'Quart de finale', venue: VENUE, createdBy: '', createdAt: D(30, 0) },
  { id: 'c0000000-0000-0000-0000-000000000004', sport: 'football', format: '5v5', type: 'tournament', status: 'completed', dateTime: D(24, 12), duration: 90, level: 'intermediate', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: [], needsPlayers: false, homeTeamId: t4, awayTeamId: t5, score: { home: 2, away: 1 }, tournamentId: DEMO_TOURNAMENT_ID, roundLabel: 'Quart de finale', venue: VENUE, createdBy: '', createdAt: D(30, 0) },
  { id: 'c0000000-0000-0000-0000-000000000005', sport: 'football', format: '5v5', type: 'tournament', status: 'completed', dateTime: D(21, 15), duration: 90, level: 'intermediate', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: [], needsPlayers: false, homeTeamId: t1, awayTeamId: t2, score: { home: 2, away: 0 }, tournamentId: DEMO_TOURNAMENT_ID, roundLabel: 'Demi-finale', venue: VENUE, createdBy: '', createdAt: D(30, 0) },
  { id: 'c0000000-0000-0000-0000-000000000006', sport: 'football', format: '5v5', type: 'tournament', status: 'completed', dateTime: D(21, 17), duration: 90, level: 'intermediate', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: [], needsPlayers: false, homeTeamId: t3, awayTeamId: t4, score: { home: 1, away: 2 }, tournamentId: DEMO_TOURNAMENT_ID, roundLabel: 'Demi-finale', venue: VENUE, createdBy: '', createdAt: D(30, 0) },
  { id: 'c0000000-0000-0000-0000-000000000007', sport: 'football', format: '5v5', type: 'tournament', status: 'completed', dateTime: D(18, 15), duration: 90, level: 'intermediate', ambiance: 'competitive', maxPlayers: 10, registeredPlayers: [], needsPlayers: false, homeTeamId: t1, awayTeamId: t4, score: { home: 3, away: 1 }, tournamentId: DEMO_TOURNAMENT_ID, roundLabel: 'Finale', venue: VENUE, createdBy: '', createdAt: D(30, 0) },
];
