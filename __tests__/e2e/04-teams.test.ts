import { supabaseAdmin, createTestUser, createTestTeam, cleanup } from './setup';

describe('TEAMS — Création', () => {
  const createdIds = { users: [] as string[], teams: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Créer une équipe → captain_id = créateur', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(team.captain_id).toBe(user.id);
  });

  test('✅ Créer → members JSONB contient déjà le capitaine', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(Array.isArray(team.members)).toBe(true);
    expect(team.members.length).toBeGreaterThan(0);
    expect(team.members[0].userId).toBe(user.id);
  });

  test('✅ Créer → co_captain_ids JSONB = [] par défaut', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(Array.isArray(team.co_captain_ids)).toBe(true);
    expect(team.co_captain_ids.length).toBe(0);
  });

  test('✅ Créer → join_requests JSONB = [] par défaut', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(Array.isArray(team.join_requests)).toBe(true);
    expect(team.join_requests.length).toBe(0);
  });

  test('✅ Créer → stats JSONB initialisé', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id);
    createdIds.teams.push(team.id);

    expect(typeof team.stats).toBe('object');
    expect(team.stats.matchesPlayed).toBe(0);
    expect(team.stats.wins).toBe(0);
  });

  test('✅ Créer avec is_recruiting = true → persisté', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const team = await createTestTeam(user.id, { is_recruiting: true });
    createdIds.teams.push(team.id);

    expect(team.is_recruiting).toBe(true);
  });
});

describe('TEAMS — Adhésion', () => {
  const createdIds = { users: [] as string[], teams: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Envoyer demande → apparaît dans join_requests JSONB', async () => {
    const captain = await createTestUser();
    const applicant = await createTestUser();
    createdIds.users.push(captain.id, applicant.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const request = {
      userId: applicant.id,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ join_requests: [request] })
      .eq('id', team.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('teams')
      .select('join_requests')
      .eq('id', team.id)
      .single();

    expect(data?.join_requests.length).toBe(1);
    expect(data?.join_requests[0].userId).toBe(applicant.id);
    expect(data?.join_requests[0].status).toBe('pending');
  });

  test('✅ Accepter demande → user ajouté dans members JSONB', async () => {
    const captain = await createTestUser();
    const applicant = await createTestUser();
    createdIds.users.push(captain.id, applicant.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const newMember = {
      userId: applicant.id,
      role: 'member',
      joinedAt: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('teams')
      .update({
        members: [...team.members, newMember],
        join_requests: []
      })
      .eq('id', team.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('teams')
      .select('members, join_requests')
      .eq('id', team.id)
      .single();

    expect(data?.members.length).toBe(2);
    expect(data?.join_requests.length).toBe(0);
  });
});

describe('TEAMS — Rôles et permissions', () => {
  const createdIds = { users: [] as string[], teams: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Capitaine peut nommer un co-capitaine → co_captain_ids mis à jour', async () => {
    const captain = await createTestUser();
    const member = await createTestUser();
    createdIds.users.push(captain.id, member.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ co_captain_ids: [member.id] })
      .eq('id', team.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('teams')
      .select('co_captain_ids')
      .eq('id', team.id)
      .single();

    expect(data?.co_captain_ids.length).toBe(1);
    expect(data?.co_captain_ids[0]).toBe(member.id);
  });

  test('✅ Capitaine peut exclure un membre → retiré de members JSONB', async () => {
    const captain = await createTestUser();
    const member = await createTestUser();
    createdIds.users.push(captain.id, member.id);

    const members = [
      { userId: captain.id, role: 'captain', joinedAt: new Date().toISOString() },
      { userId: member.id, role: 'member', joinedAt: new Date().toISOString() }
    ];

    const team = await createTestTeam(captain.id, { members });
    createdIds.teams.push(team.id);

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ members: members.filter(m => m.userId !== member.id) })
      .eq('id', team.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('teams')
      .select('members')
      .eq('id', team.id)
      .single();

    expect(data?.members.length).toBe(1);
    expect(data?.members[0].userId).toBe(captain.id);
  });
});

describe('TEAMS — Stats et réputation', () => {
  const createdIds = { users: [] as string[], teams: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Après un match gagné → stats.wins +1, stats.matchesPlayed +1', async () => {
    const captain = await createTestUser();
    createdIds.users.push(captain.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const newStats = {
      ...team.stats,
      matchesPlayed: team.stats.matchesPlayed + 1,
      wins: team.stats.wins + 1
    };

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ stats: newStats })
      .eq('id', team.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('teams')
      .select('stats')
      .eq('id', team.id)
      .single();

    expect(data?.stats.wins).toBe(1);
    expect(data?.stats.matchesPlayed).toBe(1);
  });
});

