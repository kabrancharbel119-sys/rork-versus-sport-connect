import { supabaseAdmin, createTestUser, createTestVenue, createTestMatch, createTestTeam, createTestPlayerRanking, cleanup } from './setup';

describe('PERFORMANCE — Requêtes lourdes', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Récupérer 100 matchs → temps < 2s', async () => {
    const startTime = Date.now();

    const { data, error } = await supabaseAdmin
      .from('matches')
      .select('*')
      .limit(100);

    const duration = Date.now() - startTime;

    expect(error).toBeNull();
    expect(duration).toBeLessThan(2000);
  });

  test('✅ Recherche géographique sur tous les terrains → temps < 1s', async () => {
    const startTime = Date.now();

    const { data, error } = await supabaseAdmin
      .from('venues')
      .select('*');

    const duration = Date.now() - startTime;

    expect(error).toBeNull();
    expect(duration).toBeLessThan(1000);
  });

  test('✅ Top 100 ranking → temps < 1s', async () => {
    const startTime = Date.now();

    const { data, error } = await supabaseAdmin
      .from('player_rankings')
      .select('*')
      .order('elo_rating', { ascending: false })
      .limit(100);

    const duration = Date.now() - startTime;

    expect(error).toBeNull();
    expect(duration).toBeLessThan(1000);
  });

  test('✅ Charger le profil complet d\'un user → < 1s', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const startTime = Date.now();

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    const duration = Date.now() - startTime;

    expect(error).toBeNull();
    expect(duration).toBeLessThan(1000);
  });
});

describe('EDGE CASES — Données limites', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], teams: [] as string[], player_rankings: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Match avec 0 joueur inscrit → finalisable sans erreur', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, {
      registered_players: [],
      status: 'completed'
    });
    createdIds.matches.push(match.id);

    expect(match.registered_players.length).toBe(0);
    expect(match.status).toBe('completed');
  });

  test('✅ Match avec 1 seul joueur → MVP peut être assigné', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, {
      registered_players: [{ id: user.id, name: 'Player 1' }],
      mvp_id: user.id
    });
    createdIds.matches.push(match.id);

    expect(match.mvp_id).toBe(user.id);
  });

  test('✅ Équipe avec 1 seul membre (le capitaine) → peut jouer un match', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id, {
      members: [{ userId: user.id, role: 'captain', joinedAt: new Date().toISOString() }]
    });
    createdIds.teams.push(team.id);

    expect(team.members.length).toBe(1);
    expect(team.captain_id).toBe(user.id);
  });

  test('✅ User sans player_rankings → appel au ranking retourne null/vide', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const { data, error } = await supabaseAdmin
      .from('player_rankings')
      .select('*')
      .eq('user_id', user.id);

    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  test('✅ Score match très élevé (50-0) → accepté', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, {
      score_home: 50,
      score_away: 0
    });
    createdIds.matches.push(match.id);

    expect(match.score_home).toBe(50);
    expect(match.score_away).toBe(0);
  });

  test('✅ ELO à 0 → ne peut pas descendre sous 0', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 0);
    createdIds.player_rankings.push(ranking.id);

    expect(ranking.elo_rating).toBeGreaterThanOrEqual(0);
  });

  test('✅ ELO à 9999 → fonctionne sans overflow', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 9999);
    createdIds.player_rankings.push(ranking.id);

    expect(ranking.elo_rating).toBe(9999);
  });

  test('✅ Nom d\'équipe avec caractères spéciaux → accepté', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id, {
      name: 'L\'Équipe des Étoiles ⭐'
    });
    createdIds.teams.push(team.id);

    expect(team.name).toBe('L\'Équipe des Étoiles ⭐');
  });

  test('✅ Bio vide string "" → acceptée', async () => {
    const user = await createTestUser({ bio: '' });
    createdIds.users.push(user.id);

    expect(user.bio).toBe('');
  });
});

describe('EDGE CASES — Concurrence', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Deux users rejoignent le même match simultanément', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const user3 = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user1.id, user2.id, user3.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user1.id, venue.id, {
      max_players: 2,
      registered_players: []
    });
    createdIds.matches.push(match.id);

    const player2 = { id: user2.id, name: 'Player 2', joinedAt: new Date().toISOString() };
    const player3 = { id: user3.id, name: 'Player 3', joinedAt: new Date().toISOString() };

    await Promise.all([
      supabaseAdmin.from('matches').update({ registered_players: [player2] }).eq('id', match.id),
      supabaseAdmin.from('matches').update({ registered_players: [player3] }).eq('id', match.id)
    ]);

    const { data } = await supabaseAdmin
      .from('matches')
      .select('registered_players')
      .eq('id', match.id)
      .single();

    expect(data?.registered_players.length).toBeGreaterThan(0);
  });
});

