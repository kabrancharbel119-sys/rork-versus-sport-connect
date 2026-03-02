import { supabaseAdmin, createTestUser, createTestVenue, createTestMatch, createTestPlayerRanking, cleanup } from './setup';

describe('LIVE SCORING — Initialisation', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], live_match_stats: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Passer match à in_progress → live_match_stats créé en BDD', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', match.id);

    expect(updateError).toBeNull();

    const liveStatsData = {
      match_id: match.id,
      current_minute: 0,
      half: 1,
      score_home: 0,
      score_away: 0,
      possession_home: 50,
      possession_away: 50,
      shots_home: 0,
      shots_away: 0
    };

    const { data, error } = await supabaseAdmin
      .from('live_match_stats')
      .insert(liveStatsData)
      .select()
      .single();

    createdIds.live_match_stats.push(data.id);

    expect(error).toBeNull();
    expect(data.score_home).toBe(0);
    expect(data.score_away).toBe(0);
    expect(data.half).toBe(1);
  });
});

describe('LIVE SCORING — Événements / match_events', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], match_events: [] as string[], live_match_stats: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Goal home → score_home +1 dans live_match_stats', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, { status: 'in_progress' });
    createdIds.matches.push(match.id);

    const liveStats = await supabaseAdmin
      .from('live_match_stats')
      .insert({
        match_id: match.id,
        current_minute: 10,
        half: 1,
        score_home: 0,
        score_away: 0
      })
      .select()
      .single();

    createdIds.live_match_stats.push(liveStats.data.id);

    const { error } = await supabaseAdmin
      .from('live_match_stats')
      .update({ score_home: 1 })
      .eq('match_id', match.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('live_match_stats')
      .select('score_home')
      .eq('match_id', match.id)
      .single();

    expect(data?.score_home).toBe(1);
  });

  test('✅ Goal home → match_event créé : type="goal", team_side="home"', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, { status: 'in_progress' });
    createdIds.matches.push(match.id);

    const eventData = {
      match_id: match.id,
      event_type: 'goal',
      minute: 15,
      player_id: user.id,
      team_side: 'home',
      data: { scorer: user.id }
    };

    const { data, error } = await supabaseAdmin
      .from('match_events')
      .insert(eventData)
      .select()
      .single();

    createdIds.match_events.push(data.id);

    expect(error).toBeNull();
    expect(data.event_type).toBe('goal');
    expect(data.team_side).toBe('home');
    expect(data.minute).toBe(15);
  });

  test('✅ Carton jaune → match_event créé : type="card", data contient {color:"yellow"}', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, { status: 'in_progress' });
    createdIds.matches.push(match.id);

    const eventData = {
      match_id: match.id,
      event_type: 'card',
      minute: 20,
      player_id: user.id,
      team_side: 'home',
      data: { color: 'yellow' }
    };

    const { data, error } = await supabaseAdmin
      .from('match_events')
      .insert(eventData)
      .select()
      .single();

    createdIds.match_events.push(data.id);

    expect(error).toBeNull();
    expect(data.event_type).toBe('card');
    expect(data.data.color).toBe('yellow');
  });
});

describe('LIVE SCORING — Finalisation match ranked', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[], player_rankings: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Finaliser match ranked → player_rankings mis à jour', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user1.id, user2.id);
    createdIds.venues.push(venue.id);

    const ranking1 = await createTestPlayerRanking(user1.id, 'football', 1200);
    const ranking2 = await createTestPlayerRanking(user2.id, 'football', 1000);
    createdIds.player_rankings.push(ranking1.id, ranking2.id);

    const match = await createTestMatch(user1.id, venue.id, {
      match_type: 'ranked',
      sport: 'football',
      status: 'completed',
      score_home: 3,
      score_away: 1,
      registered_players: [
        { id: user1.id, team: 'home' },
        { id: user2.id, team: 'away' }
      ]
    });
    createdIds.matches.push(match.id);

    const { error: update1 } = await supabaseAdmin
      .from('player_rankings')
      .update({
        matches_played: ranking1.matches_played + 1,
        wins: ranking1.wins + 1
      })
      .eq('id', ranking1.id);

    const { error: update2 } = await supabaseAdmin
      .from('player_rankings')
      .update({
        matches_played: ranking2.matches_played + 1,
        losses: ranking2.losses + 1
      })
      .eq('id', ranking2.id);

    expect(update1).toBeNull();
    expect(update2).toBeNull();

    const { data: updatedRanking1 } = await supabaseAdmin
      .from('player_rankings')
      .select('*')
      .eq('id', ranking1.id)
      .single();

    expect(updatedRanking1?.wins).toBe(1);
    expect(updatedRanking1?.matches_played).toBe(1);
  });
});

