import { supabaseAdmin, createTestUser, createTestMatch, createTestVenue, createTestTeam, createTestTournament, cleanup } from './setup';

describe('TYPES — Cohérence JSONB', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], teams: [] as string[], tournaments: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ matches.registered_players est un tableau', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(Array.isArray(match.registered_players)).toBe(true);
  });

  test('✅ matches.player_stats est un objet', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(typeof match.player_stats).toBe('object');
    expect(match.player_stats).not.toBeNull();
  });

  test('✅ matches.venue_data est un objet non null', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(typeof match.venue_data).toBe('object');
    expect(match.venue_data).not.toBeNull();
    expect(match.venue_data.name).toBeDefined();
  });

  test('✅ teams.members est un tableau', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(Array.isArray(team.members)).toBe(true);
    expect(team.members.length).toBeGreaterThan(0);
  });

  test('✅ teams.join_requests est un tableau', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(Array.isArray(team.join_requests)).toBe(true);
  });

  test('✅ teams.co_captain_ids est un tableau de strings', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(Array.isArray(team.co_captain_ids)).toBe(true);
  });

  test('✅ tournaments.registered_teams est un tableau', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    expect(Array.isArray(tournament.registered_teams)).toBe(true);
  });

  test('✅ tournaments.prizes est un objet avec first, second, third', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    expect(typeof tournament.prizes).toBe('object');
    expect(tournament.prizes.first).toBeDefined();
    expect(tournament.prizes.second).toBeDefined();
    expect(tournament.prizes.third).toBeDefined();
  });

  test('✅ tournaments.managers est un tableau de strings', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    expect(Array.isArray(tournament.managers)).toBe(true);
  });

  test('✅ tournaments.match_ids est un tableau de strings', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    expect(Array.isArray(tournament.match_ids)).toBe(true);
  });
});

describe('TYPES — Enums BDD', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], tournaments: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ users.role : uniquement "user" | "admin" | "premium"', async () => {
    const validRoles = ['user', 'admin', 'premium'];
    
    const user = await createTestUser({ role: 'user' });
    createdIds.users.push(user.id);

    expect(validRoles).toContain(user.role);
  });

  test('✅ matches.status : uniquement "open"|"confirmed"|"in_progress"|"completed"|"cancelled"', async () => {
    const validStatuses = ['open', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, { status: 'open' });
    createdIds.matches.push(match.id);

    expect(validStatuses).toContain(match.status);
  });

  test('✅ matches.match_type : uniquement "friendly"|"ranked"|"tournament"', async () => {
    const validTypes = ['friendly', 'ranked', 'tournament'];
    
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, { match_type: 'friendly' });
    createdIds.matches.push(match.id);

    expect(validTypes).toContain(match.match_type);
  });

  test('✅ tournaments.type : uniquement "knockout"|"round_robin"|"mixed"', async () => {
    const validTypes = ['knockout', 'round_robin', 'mixed'];
    
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id, { type: 'knockout' });
    createdIds.tournaments.push(tournament.id);

    expect(validTypes).toContain(tournament.type);
  });

  test('✅ tournaments.status : uniquement "draft"|"registration"|"in_progress"|"completed"|"cancelled"', async () => {
    const validStatuses = ['draft', 'registration', 'in_progress', 'completed', 'cancelled'];
    
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id, { status: 'draft' });
    createdIds.tournaments.push(tournament.id);

    expect(validStatuses).toContain(tournament.status);
  });
});

describe('TYPES — Fonctions API', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Appel avec paramètres valides → retourne le type attendu', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(match).toBeDefined();
    expect(match.id).toBeDefined();
    expect(typeof match.id).toBe('string');
  });

  test('✅ Appel avec ID inexistant → retourne null ou tableau vide', async () => {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    expect(data).toBeNull();
  });
});

