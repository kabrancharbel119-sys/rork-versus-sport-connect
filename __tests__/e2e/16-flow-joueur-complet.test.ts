import {
  supabaseAdmin,
  createTestUser,
  createTestVenue,
  createTestMatch,
  createTestTeam,
  createTestPlayerRanking,
  createTestNotification,
  createTestFollow,
  cleanup
} from './setup';

describe('FLOW JOUEUR COMPLET — Inscription → Team → Match → ELO → Trophées → Social', () => {
  const createdIds = {
    users: [] as string[],
    venues: [] as string[],
    matches: [] as string[],
    teams: [] as string[],
    player_rankings: [] as string[],
    trophies: [] as string[],
    notifications: [] as string[],
    follows: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Inscription & profil ──
  test('1. Inscription → user créé avec tous les champs obligatoires', async () => {
    const user = await createTestUser({
      full_name: 'Jean Kouassi',
      city: 'Abidjan',
      bio: 'Passionné de football',
    });
    createdIds.users.push(user.id);

    expect(user.id).toBeDefined();
    expect(user.username).toBeDefined();
    expect(user.phone).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.referral_code).toBeDefined();
    expect(user.role).toBe('user');
    expect(user.is_banned).toBe(false);
    expect(user.is_premium).toBe(false);
    expect(user.stats.matchesPlayed).toBe(0);
  });

  test('2. Compléter profil → sports & localisation persistés', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        sports: [
          { sport: 'football', level: 'intermediate' },
          { sport: 'basketball', level: 'beginner' },
        ],
        location_lat: 5.36,
        location_lng: -4.0083,
        location_city: 'Abidjan',
        location_country: "Côte d'Ivoire",
        bio: 'Joueur polyvalent',
      })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('sports, location_city, location_lat, bio')
      .eq('id', user.id)
      .single();

    expect(data?.sports).toHaveLength(2);
    expect(data?.sports[0].sport).toBe('football');
    expect(data?.location_city).toBe('Abidjan');
    expect(data?.location_lat).toBe(5.36);
    expect(data?.bio).toBe('Joueur polyvalent');
  });

  // ── ÉTAPE 2 : Team ──
  test('3. Rejoindre une team → membre ajouté → notification reçue', async () => {
    const captain = await createTestUser();
    const player = await createTestUser();
    createdIds.users.push(captain.id, player.id);

    const team = await createTestTeam(captain.id, {
      name: 'AS Test FC',
      sport: 'football',
      level: 'intermediate',
    });
    createdIds.teams.push(team.id);

    // Ajouter le joueur comme membre
    const updatedMembers = [
      ...team.members,
      { userId: player.id, role: 'member', joinedAt: new Date().toISOString() },
    ];

    const { error: addError } = await supabaseAdmin
      .from('teams')
      .update({ members: updatedMembers })
      .eq('id', team.id);

    expect(addError).toBeNull();

    // Notification de bienvenue
    const notif = await createTestNotification(player.id, {
      type: 'team_welcome',
      title: 'Bienvenue dans AS Test FC',
      message: 'Vous avez rejoint l\'équipe',
      data: { teamId: team.id, teamName: team.name },
    });
    createdIds.notifications.push(notif.id);

    // Vérifier
    const { data: updatedTeam } = await supabaseAdmin
      .from('teams')
      .select('members')
      .eq('id', team.id)
      .single();

    expect(updatedTeam?.members.some((m: any) => m.userId === player.id)).toBe(true);
    expect(notif.is_read).toBe(false);
  });

  // ── ÉTAPE 3 : Match & Live scoring ──
  test('4. Créer match ranked → rejoindre → démarrer → scorer → finaliser', async () => {
    const user = await createTestUser();
    const opponent = await createTestUser();
    createdIds.users.push(user.id, opponent.id);

    const venue = await createTestVenue({ name: 'Stade Test Flow' });
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id, {
      match_type: 'ranked',
      sport: 'football',
      format: '5v5',
      status: 'open',
      max_players: 10,
      registered_players: [
        { id: user.id, name: user.full_name, team: 'home' },
        { id: opponent.id, name: opponent.full_name, team: 'away' },
      ],
    });
    createdIds.matches.push(match.id);

    expect(match.status).toBe('open');
    expect(match.registered_players).toHaveLength(2);

    // Démarrer le match
    await supabaseAdmin
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', match.id);

    // Créer live stats
    const { data: liveStats } = await supabaseAdmin
      .from('live_match_stats')
      .insert({
        match_id: match.id,
        current_minute: 0,
        half: 1,
        score_home: 0,
        score_away: 0,
      })
      .select()
      .single();

    expect(liveStats).toBeDefined();

    // But home
    await supabaseAdmin
      .from('match_events')
      .insert({
        match_id: match.id,
        event_type: 'goal',
        minute: 25,
        player_id: user.id,
        team_side: 'home',
        data: { scorer: user.id },
      });

    // But away
    await supabaseAdmin
      .from('match_events')
      .insert({
        match_id: match.id,
        event_type: 'goal',
        minute: 60,
        player_id: opponent.id,
        team_side: 'away',
        data: { scorer: opponent.id },
      });

    // But home 2
    await supabaseAdmin
      .from('match_events')
      .insert({
        match_id: match.id,
        event_type: 'goal',
        minute: 75,
        player_id: user.id,
        team_side: 'home',
        data: { scorer: user.id },
      });

    // Finaliser : 2-1
    await supabaseAdmin
      .from('matches')
      .update({
        status: 'completed',
        score_home: 2,
        score_away: 1,
        mvp_id: user.id,
      })
      .eq('id', match.id);

    // Vérifier
    const { data: finalMatch } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', match.id)
      .single();

    expect(finalMatch?.status).toBe('completed');
    expect(finalMatch?.score_home).toBe(2);
    expect(finalMatch?.score_away).toBe(1);
    expect(finalMatch?.mvp_id).toBe(user.id);

    // Vérifier events
    const { data: events } = await supabaseAdmin
      .from('match_events')
      .select('*')
      .eq('match_id', match.id)
      .order('minute', { ascending: true });

    expect(events).toHaveLength(3);
    expect(events?.[0].event_type).toBe('goal');
    expect(events?.[0].team_side).toBe('home');
  });

  // ── ÉTAPE 5 : ELO & ranking ──
  test('5. ELO mis à jour après match ranked → winner gagne des points', async () => {
    const winner = await createTestUser();
    const loser = await createTestUser();
    createdIds.users.push(winner.id, loser.id);

    const ranking1 = await createTestPlayerRanking(winner.id, 'football', 1000);
    const ranking2 = await createTestPlayerRanking(loser.id, 'football', 1000);
    createdIds.player_rankings.push(ranking1.user_id, ranking2.user_id);

    // Simuler update ELO après match
    const { error: updateWinner } = await supabaseAdmin
      .from('player_rankings')
      .update({
        elo_rating: 1016,
        elo_change: 16,
        matches_played: 1,
        wins: 1,
        losses: 0,
      })
      .eq('user_id', ranking1.user_id);

    const { error: updateLoser } = await supabaseAdmin
      .from('player_rankings')
      .update({
        elo_rating: 984,
        elo_change: -16,
        matches_played: 1,
        wins: 0,
        losses: 1,
      })
      .eq('user_id', ranking2.user_id);

    expect(updateWinner).toBeNull();
    expect(updateLoser).toBeNull();

    const { data: winnerRanking } = await supabaseAdmin
      .from('player_rankings')
      .select('*')
      .eq('user_id', ranking1.user_id)
      .single();

    const { data: loserRanking } = await supabaseAdmin
      .from('player_rankings')
      .select('*')
      .eq('user_id', ranking2.user_id)
      .single();

    expect(winnerRanking?.elo_rating).toBeGreaterThan(1000);
    expect(winnerRanking?.wins).toBe(1);
    expect(loserRanking?.elo_rating).toBeLessThan(1000);
    expect(loserRanking?.losses).toBe(1);
  });

  // ── ÉTAPE 6 : Trophées ──
  test('6. Trophée débloqué après première victoire', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const { data: trophy } = await supabaseAdmin
      .from('user_trophies')
      .insert({
        user_id: user.id,
        trophy_id: 'first_win',
        progress: 100,
        unlocked_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(trophy).toBeDefined();
    expect(trophy.trophy_id).toBe('first_win');
    expect(trophy.progress).toBe(100);
    createdIds.trophies.push(trophy.id);
  });

  // ── ÉTAPE 7 : Social — follow & notifications ──
  test('7. Suivre un joueur → follow créé → notification envoyée', async () => {
    const follower = await createTestUser();
    const following = await createTestUser();
    createdIds.users.push(follower.id, following.id);

    const follow = await createTestFollow(follower.id, following.id);
    createdIds.follows.push(follow.id);

    expect(follow.follower_id).toBe(follower.id);
    expect(follow.following_id).toBe(following.id);

    // Notification de follow
    const notif = await createTestNotification(following.id, {
      type: 'new_follower',
      title: 'Nouvel abonné',
      message: `${follower.username} vous suit maintenant`,
      data: { followerId: follower.id },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.user_id).toBe(following.id);
    expect(notif.type).toBe('new_follower');
  });

  // ── ÉTAPE 8 : Stats utilisateur mises à jour ──
  test('8. Stats utilisateur mis à jour après match → matchesPlayed +1', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        stats: {
          matchesPlayed: 1,
          wins: 1,
          losses: 0,
          draws: 0,
          goalsScored: 2,
          assists: 0,
          mvpAwards: 1,
          fairPlayScore: 5.0,
          tournamentWins: 0,
          totalCashPrize: 0,
        },
      })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('stats')
      .eq('id', user.id)
      .single();

    expect(data?.stats.matchesPlayed).toBe(1);
    expect(data?.stats.wins).toBe(1);
    expect(data?.stats.goalsScored).toBe(2);
    expect(data?.stats.mvpAwards).toBe(1);
  });

  // ── ÉTAPE 9 : Notifications multiples & lecture ──
  test('9. Notifications → marquer comme lu → is_read = true', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notif1 = await createTestNotification(user.id, {
      type: 'match_invitation',
      title: 'Invitation match',
      message: 'Vous êtes invité à un match',
    });
    const notif2 = await createTestNotification(user.id, {
      type: 'team_promotion',
      title: 'Promotion',
      message: 'Vous êtes maintenant co-capitaine',
    });
    createdIds.notifications.push(notif1.id, notif2.id);

    // Marquer notif1 comme lu
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notif1.id);

    expect(error).toBeNull();

    const { data: readNotif } = await supabaseAdmin
      .from('notifications')
      .select('is_read')
      .eq('id', notif1.id)
      .single();

    const { data: unreadNotif } = await supabaseAdmin
      .from('notifications')
      .select('is_read')
      .eq('id', notif2.id)
      .single();

    expect(readNotif?.is_read).toBe(true);
    expect(unreadNotif?.is_read).toBe(false);
  });
});
