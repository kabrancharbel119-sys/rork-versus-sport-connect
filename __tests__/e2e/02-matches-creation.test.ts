import { supabaseAdmin, createTestUser, createTestVenue, createTestMatch, cleanup } from './setup';

describe('MATCHES — Création', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Créer match complet → tous les champs insérés correctement', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, {
      sport: 'football',
      format: '5v5',
      level: 'intermediate',
      ambiance: 'casual'
    });
    createdIds.matches.push(match.id);

    expect(match.id).toBeDefined();
    expect(match.sport).toBe('football');
    expect(match.format).toBe('5v5');
    expect(match.venue_id).toBe(venue.id);
    expect(match.created_by).toBe(user.id);
  });

  test('✅ title est auto-généré si absent → title != null en BDD', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(match.title).toBeDefined();
    expect(match.title).not.toBeNull();
    expect(typeof match.title).toBe('string');
  });

  test('✅ match_type = "friendly" correctement stocké', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, { match_type: 'friendly' });
    createdIds.matches.push(match.id);

    expect(match.match_type).toBe('friendly');
  });

  test('✅ match_type = "ranked" correctement stocké', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, { match_type: 'ranked' });
    createdIds.matches.push(match.id);

    expect(match.match_type).toBe('ranked');
  });

  test('✅ start_time mappé depuis dateTime → non null en BDD', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const dateTime = new Date(Date.now() + 86400000).toISOString();
    const match = await createTestMatch(user.id, venue.id, { date_time: dateTime, start_time: dateTime });
    createdIds.matches.push(match.id);

    expect(match.start_time).toBeDefined();
    expect(match.start_time).not.toBeNull();
  });

  test('✅ registered_players = JSONB tableau vide par défaut', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(Array.isArray(match.registered_players)).toBe(true);
    expect(match.registered_players.length).toBe(0);
  });

  test('✅ player_stats = JSONB objet vide par défaut', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(typeof match.player_stats).toBe('object');
    expect(match.player_stats).not.toBeNull();
  });

  test('✅ venue_data JSONB correctement sérialisé', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const venueData = { id: venue.id, name: 'Test Stadium', city: 'Abidjan' };
    const match = await createTestMatch(user.id, venue.id, { venue_data: venueData });
    createdIds.matches.push(match.id);

    expect(typeof match.venue_data).toBe('object');
    expect(match.venue_data.name).toBe('Test Stadium');
  });

  test('✅ status = "open" par défaut', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    expect(match.status).toBe('open');
  });

  test('✅ needs_players = true/false correctement stocké', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match1 = await createTestMatch(user.id, venue.id, { needs_players: true });
    const match2 = await createTestMatch(user.id, venue.id, { needs_players: false });
    createdIds.matches.push(match1.id, match2.id);

    expect(match1.needs_players).toBe(true);
    expect(match2.needs_players).toBe(false);
  });

  test('❌ entry_fee négatif → refusé', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    await expect(
      createTestMatch(user.id, venue.id, { entry_fee: -100 })
    ).rejects.toThrow();
  });

  test('❌ max_players = 0 → refusé', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    await expect(
      createTestMatch(user.id, venue.id, { max_players: 0 })
    ).rejects.toThrow();
  });
});

describe('MATCHES — Inscription joueurs', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Rejoindre un match open → joueur ajouté dans registered_players JSONB', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const venueId = await createTestVenue();
    createdIds.users.push(user1.id, user2.id);
    createdIds.venues.push(venueId);

    const match = await createTestMatch(user1.id, venueId);
    createdIds.matches.push(match.id);

    const newPlayer = { id: user2.id, name: `${user2.first_name} ${user2.last_name}`, joinedAt: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ registered_players: [...match.registered_players, newPlayer] })
      .eq('id', match.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('matches')
      .select('registered_players')
      .eq('id', match.id)
      .single();

    expect(Array.isArray(data?.registered_players)).toBe(true);
    expect(data?.registered_players.length).toBe(1);
    expect(data?.registered_players[0].id).toBe(user2.id);
  });

  test('✅ Se désinscrire → joueur retiré du JSONB', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const venueId = await createTestVenue();
    createdIds.users.push(user1.id, user2.id);
    createdIds.venues.push(venueId);

    const registeredPlayers = [
      { id: user2.id, name: `${user2.first_name} ${user2.last_name}`, joinedAt: new Date().toISOString() }
    ];
    const match = await createTestMatch(user1.id, venueId, { registered_players: registeredPlayers });
    createdIds.matches.push(match.id);

    const { error } = await supabaseAdmin
      .from('matches')
      .update({ registered_players: [] })
      .eq('id', match.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('matches')
      .select('registered_players')
      .eq('id', match.id)
      .single();

    expect(data?.registered_players.length).toBe(0);
  });
});

describe('MATCHES — Filtres et recherche', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Filtrer par sport → uniquement les matchs du sport retournés', async () => {
    const user = await createTestUser();
    const venueId = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venueId);

    const footballMatch = await createTestMatch(user.id, venueId, { sport: 'football' });
    const basketMatch = await createTestMatch(user.id, venueId, { sport: 'basketball' });
    createdIds.matches.push(footballMatch.id, basketMatch.id);

    const { data } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('sport', 'football')
      .in('id', [footballMatch.id, basketMatch.id]);

    expect(data?.length).toBe(1);
    expect(data?.[0].sport).toBe('football');
  });

  test('✅ Filtrer par statut → uniquement ce statut', async () => {
    const user = await createTestUser();
    const venueId = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venueId);

    const openMatch = await createTestMatch(user.id, venueId, { status: 'open' });
    const completedMatch = await createTestMatch(user.id, venueId, { status: 'completed' });
    createdIds.matches.push(openMatch.id, completedMatch.id);

    const { data } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('status', 'open')
      .in('id', [openMatch.id, completedMatch.id]);

    expect(data?.length).toBe(1);
    expect(data?.[0].status).toBe('open');
  });

  test('✅ Filtrer needs_players = true → uniquement les matchs cherchant joueurs', async () => {
    const user = await createTestUser();
    const venueId = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venueId);

    const needsMatch = await createTestMatch(user.id, venueId, { needs_players: true });
    const fullMatch = await createTestMatch(user.id, venueId, { needs_players: false });
    createdIds.matches.push(needsMatch.id, fullMatch.id);

    const { data } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('needs_players', true)
      .in('id', [needsMatch.id, fullMatch.id]);

    expect(data?.length).toBe(1);
    expect(data?.[0].needs_players).toBe(true);
  });
});

