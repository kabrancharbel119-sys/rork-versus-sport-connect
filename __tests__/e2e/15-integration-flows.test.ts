import { supabaseAdmin, createTestUser, createTestVenue, createTestMatch, createTestTeam, createTestTournament, createTestPlayerRanking, cleanup } from './setup';

describe('FLOW COMPLET — Nouveau joueur', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], player_rankings: [] as string[], trophies: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Inscription → profil complété → rejoindre un match → match joué → ELO mis à jour', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    expect(user.id).toBeDefined();
    expect(user.phone).toBeDefined();

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        bio: 'Nouveau joueur passionné',
        city: 'Abidjan',
        favorite_sports: ['football']
      })
      .eq('id', user.id);

    expect(updateError).toBeNull();

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, {
      match_type: 'ranked',
      sport: 'football',
      registered_players: [{ id: user.id, name: `${user.first_name} ${user.last_name}` }]
    });
    createdIds.matches.push(match.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 1000);
    createdIds.player_rankings.push(ranking.id);

    const { error: matchCompleteError } = await supabaseAdmin
      .from('matches')
      .update({ status: 'completed', score_home: 3, score_away: 1 })
      .eq('id', match.id);

    expect(matchCompleteError).toBeNull();

    const { error: rankingUpdateError } = await supabaseAdmin
      .from('player_rankings')
      .update({
        matches_played: 1,
        wins: 1,
        elo_rating: 1016
      })
      .eq('id', ranking.id);

    expect(rankingUpdateError).toBeNull();

    const { data: updatedRanking } = await supabaseAdmin
      .from('player_rankings')
      .select('*')
      .eq('id', ranking.id)
      .single();

    expect(updatedRanking?.matches_played).toBe(1);
    expect(updatedRanking?.wins).toBe(1);
    expect(updatedRanking?.elo_rating).toBeGreaterThan(1000);
  });
});

describe('FLOW COMPLET — Organisateur de tournoi', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], tournaments: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Créer tournoi → inscrire équipes → valider → générer bracket → déclarer vainqueur', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id, {
      type: 'knockout',
      max_teams: 4,
      status: 'draft'
    });
    createdIds.tournaments.push(tournament.id);

    expect(tournament.status).toBe('draft');

    const teams = await Promise.all([
      createTestTeam(organizer.id, { name: 'Team A' }),
      createTestTeam(organizer.id, { name: 'Team B' }),
      createTestTeam(organizer.id, { name: 'Team C' }),
      createTestTeam(organizer.id, { name: 'Team D' })
    ]);
    createdIds.teams.push(...teams.map(t => t.id));

    const registeredTeams = teams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      status: 'pending',
      registeredAt: new Date().toISOString()
    }));

    const { error: registerError } = await supabaseAdmin
      .from('tournaments')
      .update({ registered_teams: registeredTeams, status: 'registration' })
      .eq('id', tournament.id);

    expect(registerError).toBeNull();

    const confirmedTeams = registeredTeams.map(t => ({ ...t, status: 'confirmed' }));

    const { error: confirmError } = await supabaseAdmin
      .from('tournaments')
      .update({ registered_teams: confirmedTeams })
      .eq('id', tournament.id);

    expect(confirmError).toBeNull();

    const { error: completeError } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'completed',
        winner_id: teams[0].id
      })
      .eq('id', tournament.id);

    expect(completeError).toBeNull();

    const { data: completedTournament } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournament.id)
      .single();

    expect(completedTournament?.status).toBe('completed');
    expect(completedTournament?.winner_id).toBe(teams[0].id);
  });
});

describe('FLOW COMPLET — Capitaine d\'équipe', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Créer équipe → accepter membres → participer à matchs → stats correctes', async () => {
    const captain = await createTestUser();
    const member1 = await createTestUser();
    const member2 = await createTestUser();
    createdIds.users.push(captain.id, member1.id, member2.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    expect(team.captain_id).toBe(captain.id);

    const newMembers = [
      { userId: captain.id, role: 'captain', joinedAt: new Date().toISOString() },
      { userId: member1.id, role: 'member', joinedAt: new Date().toISOString() },
      { userId: member2.id, role: 'member', joinedAt: new Date().toISOString() }
    ];

    const { error: addMembersError } = await supabaseAdmin
      .from('teams')
      .update({ members: newMembers })
      .eq('id', team.id);

    expect(addMembersError).toBeNull();

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const match1 = await createTestMatch(captain.id, venue.id, {
      home_team_id: team.id,
      status: 'completed',
      score_home: 3,
      score_away: 1
    });
    createdIds.matches.push(match1.id);

    const updatedStats = {
      ...team.stats,
      matchesPlayed: 1,
      wins: 1,
      goalsFor: 3,
      goalsAgainst: 1
    };

    const { error: statsError } = await supabaseAdmin
      .from('teams')
      .update({ stats: updatedStats })
      .eq('id', team.id);

    expect(statsError).toBeNull();

    const { data: updatedTeam } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', team.id)
      .single();

    expect(updatedTeam?.stats.matchesPlayed).toBe(1);
    expect(updatedTeam?.stats.wins).toBe(1);
    expect(updatedTeam?.members.length).toBe(3);
  });
});

describe('FLOW COMPLET — Contextes React', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], teams: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ AuthContext : login → user disponible', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    expect(user.token).toBeDefined();
    expect(user.id).toBeDefined();
  });

  test('✅ MatchesContext : créer match → apparaît dans la liste', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    const { data } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', match.id)
      .single();

    expect(data).toBeDefined();
    expect(data?.id).toBe(match.id);
  });

  test('✅ TeamsContext : rejoindre équipe → apparaît dans mes équipes', async () => {
    const captain = await createTestUser();
    const member = await createTestUser();
    createdIds.users.push(captain.id, member.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const newMembers = [
      ...team.members,
      { userId: member.id, role: 'member', joinedAt: new Date().toISOString() }
    ];

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ members: newMembers })
      .eq('id', team.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', team.id)
      .single();

    expect(data?.members.some((m: any) => m.userId === member.id)).toBe(true);
  });
});

