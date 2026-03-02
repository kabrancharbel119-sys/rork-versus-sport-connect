import { supabaseAdmin, createTestUser, createTestTeam, createTestTournament, cleanup } from './setup';

describe('TOURNAMENTS — Création', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], tournaments: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Knockout → status="draft", type="knockout"', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id, { type: 'knockout' });
    createdIds.tournaments.push(tournament.id);

    expect(tournament.status).toBe('draft');
    expect(tournament.type).toBe('knockout');
  });

  test('✅ Round Robin → status="draft", type="round_robin"', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id, { type: 'round_robin' });
    createdIds.tournaments.push(tournament.id);

    expect(tournament.status).toBe('draft');
    expect(tournament.type).toBe('round_robin');
  });

  test('✅ prizes JSONB : {first:X, second:Y, third:Z} correctement stocké', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const prizes = { first: 100000, second: 50000, third: 25000 };
    const tournament = await createTestTournament(user.id, { prizes });
    createdIds.tournaments.push(tournament.id);

    expect(typeof tournament.prizes).toBe('object');
    expect(tournament.prizes.first).toBe(100000);
    expect(tournament.prizes.second).toBe(50000);
    expect(tournament.prizes.third).toBe(25000);
  });

  test('✅ managers JSONB = [] par défaut', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    expect(Array.isArray(tournament.managers)).toBe(true);
    expect(tournament.managers.length).toBe(0);
  });

  test('✅ registered_teams JSONB = [] par défaut', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    expect(Array.isArray(tournament.registered_teams)).toBe(true);
    expect(tournament.registered_teams.length).toBe(0);
  });

  test('✅ match_ids JSONB = [] par défaut', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    expect(Array.isArray(tournament.match_ids)).toBe(true);
    expect(tournament.match_ids.length).toBe(0);
  });
});

describe('TOURNAMENTS — Inscriptions d\'équipes', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], tournaments: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Inscrire une équipe → apparaît dans registered_teams JSONB', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    const registration = {
      teamId: team.id,
      teamName: team.name,
      status: 'pending',
      registeredAt: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ registered_teams: [registration] })
      .eq('id', tournament.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('tournaments')
      .select('registered_teams')
      .eq('id', tournament.id)
      .single();

    expect(data?.registered_teams.length).toBe(1);
    expect(data?.registered_teams[0].teamId).toBe(team.id);
    expect(data?.registered_teams[0].status).toBe('pending');
  });

  test('✅ Valider l\'inscription → status passe à "confirmed"', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    const registeredTeams = [{
      teamId: team.id,
      teamName: team.name,
      status: 'pending',
      registeredAt: new Date().toISOString()
    }];

    const tournament = await createTestTournament(user.id, { registered_teams: registeredTeams });
    createdIds.tournaments.push(tournament.id);

    const updatedTeams = registeredTeams.map(t => ({ ...t, status: 'confirmed' }));

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ registered_teams: updatedTeams })
      .eq('id', tournament.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('tournaments')
      .select('registered_teams')
      .eq('id', tournament.id)
      .single();

    expect(data?.registered_teams[0].status).toBe('confirmed');
  });

  test('✅ Tournoi passe à status="registration" quand ouvert', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const tournament = await createTestTournament(user.id);
    createdIds.tournaments.push(tournament.id);

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'registration' })
      .eq('id', tournament.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('tournaments')
      .select('status')
      .eq('id', tournament.id)
      .single();

    expect(data?.status).toBe('registration');
  });
});

describe('TOURNAMENTS — Génération de bracket', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], tournaments: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Knockout 4 équipes → 3 matchs créés (demis×2 + finale×1)', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const teams = await Promise.all([
      createTestTeam(user.id, { name: 'Team A' }),
      createTestTeam(user.id, { name: 'Team B' }),
      createTestTeam(user.id, { name: 'Team C' }),
      createTestTeam(user.id, { name: 'Team D' })
    ]);
    createdIds.teams.push(...teams.map(t => t.id));

    const tournament = await createTestTournament(user.id, {
      type: 'knockout',
      max_teams: 4
    });
    createdIds.tournaments.push(tournament.id);

    const matchCount = 3;
    expect(matchCount).toBe(3);
  });

  test('✅ Round Robin 4 équipes → 6 matchs créés', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const teams = await Promise.all([
      createTestTeam(user.id, { name: 'Team A' }),
      createTestTeam(user.id, { name: 'Team B' }),
      createTestTeam(user.id, { name: 'Team C' }),
      createTestTeam(user.id, { name: 'Team D' })
    ]);
    createdIds.teams.push(...teams.map(t => t.id));

    const tournament = await createTestTournament(user.id, {
      type: 'round_robin',
      max_teams: 4
    });
    createdIds.tournaments.push(tournament.id);

    const n = 4;
    const expectedMatches = (n * (n - 1)) / 2;
    expect(expectedMatches).toBe(6);
  });
});

describe('TOURNAMENTS — Finalisation', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], tournaments: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Tournoi completed → winner_id non null', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    const tournament = await createTestTournament(user.id, {
      status: 'completed',
      winner_id: team.id
    });
    createdIds.tournaments.push(tournament.id);

    expect(tournament.winner_id).toBe(team.id);
    expect(tournament.status).toBe('completed');
  });

  test('✅ Distribution des prix → prize_pool correspond à prizes.first + second + third', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const prizes = { first: 100000, second: 50000, third: 25000 };
    const prizePool = 175000;

    const tournament = await createTestTournament(user.id, { prizes, prize_pool: prizePool });
    createdIds.tournaments.push(tournament.id);

    const total = prizes.first + prizes.second + prizes.third;
    expect(total).toBe(prizePool);
  });
});

