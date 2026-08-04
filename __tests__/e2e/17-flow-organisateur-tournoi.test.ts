import {
  supabaseAdmin,
  createTestUser,
  createTestTeam,
  createTestTournament,
  createTestVenue,
  createTestMatch,
  createTestTournamentPayment,
  createTestTournamentTeam,
  createTestPayoutRequest,
  createTestDispute,
  createTestNotification,
  cleanup
} from './setup';

describe('FLOW ORGANISATEUR TOURNOI — Création → Inscriptions → Paiements → Matchs → Winner → Payouts', () => {
  const createdIds = {
    users: [] as string[],
    teams: [] as string[],
    tournaments: [] as string[],
    matches: [] as string[],
    venues: [] as string[],
    tournament_payments: [] as string[],
    tournament_teams: [] as string[],
    tournament_payout_requests: [] as string[],
    tournament_disputes: [] as string[],
    notifications: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Création du tournoi ──
  test('1. Créer tournoi avec frais d\'inscription & prize pool', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const venue = await createTestVenue({ name: 'Stade Tournoi Test' });
    createdIds.venues.push(venue.id);

    const tournament = await createTestTournament(organizer.id, {
      name: 'Coupe Test 2026',
      sport: 'football',
      format: '5v5',
      type: 'knockout',
      max_teams: 8,
      entry_fee: 5000,
      prize_pool: 30000,
      prizes: { first: 20000, second: 10000, third: 0 },
      status: 'registration',
      entry_payment_mode: 'in_app_immediate',
      venue_id: venue.id,
      venue_data: { id: venue.id, name: venue.name },
    });
    createdIds.tournaments.push(tournament.id);

    expect(tournament.status).toBe('registration');
    expect(tournament.entry_fee).toBe(5000);
    expect(tournament.prize_pool).toBe(30000);
    expect(tournament.max_teams).toBe(8);
    expect(tournament.type).toBe('knockout');
  });

  // ── ÉTAPE 2 : Inscription des équipes ──
  test('2. 4 équipes s\'inscrivent → registered_teams mis à jour', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id, {
      max_teams: 8,
      entry_fee: 5000,
    });
    createdIds.tournaments.push(tournament.id);

    const teams = await Promise.all([
      createTestTeam(organizer.id, { name: 'Team Alpha' }),
      createTestTeam(organizer.id, { name: 'Team Beta' }),
      createTestTeam(organizer.id, { name: 'Team Gamma' }),
      createTestTeam(organizer.id, { name: 'Team Delta' }),
    ]);
    createdIds.teams.push(...teams.map(t => t.id));

    const registeredTeams = teams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      status: 'pending',
      registeredAt: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ registered_teams: registeredTeams })
      .eq('id', tournament.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('tournaments')
      .select('registered_teams')
      .eq('id', tournament.id)
      .single();

    expect(data?.registered_teams).toHaveLength(4);
    expect(data?.registered_teams[0].teamName).toBe('Team Alpha');
  });

  // ── ÉTAPE 3 : Paiements d'inscription ──
  test('3. Paiements d\'inscription → tournament_payments & tournament_teams créés', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id, { entry_fee: 5000 });
    createdIds.tournaments.push(tournament.id);

    const team = await createTestTeam(organizer.id);
    createdIds.teams.push(team.id);

    // Créer payment
    const payment = await createTestTournamentPayment(tournament.id, team.id, {
      amount: 5000,
      status: 'succeeded',
      organizer_amount: 4500,
      platform_fee: 500,
      payout_status: 'pending',
    });
    createdIds.tournament_payments.push(payment.id);

    // Créer tournament_team avec status confirmed
    const tt = await createTestTournamentTeam(tournament.id, team.id, {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    });
    createdIds.tournament_teams.push(tt.id);

    expect(payment.status).toBe('succeeded');
    expect(payment.organizer_amount).toBe(4500);
    expect(payment.platform_fee).toBe(500);
    expect(tt.status).toBe('confirmed');
  });

  // ── ÉTAPE 4 : Démarrage du tournoi ──
  test('4. Tournoi passe à status="ongoing" → matchs liés', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const tournament = await createTestTournament(organizer.id, {
      status: 'registration',
      max_teams: 4,
    });
    createdIds.tournaments.push(tournament.id);

    // Créer 2 matchs pour le bracket
    const match1 = await createTestMatch(organizer.id, venue.id, {
      sport: 'football',
      format: '5v5',
      match_type: 'tournament',
      status: 'scheduled',
      tournament_id: tournament.id,
      round_label: 'Demi-finale 1',
    });
    const match2 = await createTestMatch(organizer.id, venue.id, {
      sport: 'football',
      format: '5v5',
      match_type: 'tournament',
      status: 'scheduled',
      tournament_id: tournament.id,
      round_label: 'Demi-finale 2',
    });
    createdIds.matches.push(match1.id, match2.id);

    // Lier les matchs au tournoi
    const { error: linkError } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'ongoing',
        match_ids: [match1.id, match2.id],
      })
      .eq('id', tournament.id);

    expect(linkError).toBeNull();

    const { data: ongoingTournament } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournament.id)
      .single();

    expect(ongoingTournament?.status).toBe('ongoing');
    expect(ongoingTournament?.match_ids).toHaveLength(2);
  });

  // ── ÉTAPE 5 : Matchs joués & scores ──
  test('5. Matchs de tournoi joués → scores enregistrés', async () => {
    const organizer = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(organizer.id);
    createdIds.venues.push(venue.id);

    const team1 = await createTestTeam(organizer.id, { name: 'Winner Team' });
    const team2 = await createTestTeam(organizer.id, { name: 'Loser Team' });
    createdIds.teams.push(team1.id, team2.id);

    const match = await createTestMatch(organizer.id, venue.id, {
      match_type: 'tournament',
      home_team_id: team1.id,
      away_team_id: team2.id,
      status: 'in_progress',
    });
    createdIds.matches.push(match.id);

    // Finaliser le match
    const { error } = await supabaseAdmin
      .from('matches')
      .update({
        status: 'completed',
        score_home: 3,
        score_away: 0,
      })
      .eq('id', match.id);

    expect(error).toBeNull();

    const { data: finalMatch } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', match.id)
      .single();

    expect(finalMatch?.status).toBe('completed');
    expect(finalMatch?.score_home).toBe(3);
    expect(finalMatch?.score_away).toBe(0);
    expect(finalMatch?.home_team_id).toBe(team1.id);
  });

  // ── ÉTAPE 6 : Déclarer le vainqueur ──
  test('6. Tournoi terminé → winner_id déclaré → status="completed"', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const winnerTeam = await createTestTeam(organizer.id, { name: 'Champion' });
    createdIds.teams.push(winnerTeam.id);

    const tournament = await createTestTournament(organizer.id, {
      status: 'ongoing',
    });
    createdIds.tournaments.push(tournament.id);

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'completed',
        winner_id: winnerTeam.id,
      })
      .eq('id', tournament.id);

    expect(error).toBeNull();

    const { data: completed } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournament.id)
      .single();

    expect(completed?.status).toBe('completed');
    expect(completed?.winner_id).toBe(winnerTeam.id);
  });

  // ── ÉTAPE 7 : Demande de payout organisateur ──
  test('7. Organisateur demande un payout → request créée avec status="pending"', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id, {
      status: 'completed',
    });
    createdIds.tournaments.push(tournament.id);

    const payout = await createTestPayoutRequest(tournament.id, organizer.id, {
      requested_amount: 40000,
      purpose_category: 'venue',
      reason: 'Paiement location terrain',
      status: 'pending',
    });
    createdIds.tournament_payout_requests.push(payout.id);

    expect(payout.status).toBe('pending');
    expect(payout.requested_amount).toBe(40000);
    expect(payout.purpose_category).toBe('venue');
  });

  // ── ÉTAPE 8 : Admin approuve le payout ──
  test('8. Admin approuve payout → status="approved" → disbursement_status mis à jour', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const payout = await createTestPayoutRequest(tournament.id, organizer.id, {
      status: 'pending',
    });
    createdIds.tournament_payout_requests.push(payout.id);

    const { error } = await supabaseAdmin
      .from('tournament_payout_requests')
      .update({
        status: 'approved',
        disbursement_status: 'sent_to_organizer',
        disbursed_at: new Date().toISOString(),
      })
      .eq('id', payout.id);

    expect(error).toBeNull();

    const { data: approved } = await supabaseAdmin
      .from('tournament_payout_requests')
      .select('*')
      .eq('id', payout.id)
      .single();

    expect(approved?.status).toBe('approved');
    expect(approved?.disbursement_status).toBe('sent_to_organizer');
  });

  // ── ÉTAPE 9 : Litige sur tournoi ──
  test('9. Litige ouvert → dispute créée avec status="open"', async () => {
    const organizer = await createTestUser();
    const reporter = await createTestUser();
    createdIds.users.push(organizer.id, reporter.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const dispute = await createTestDispute(tournament.id, reporter.id, {
      severity: 'major',
      reason: 'Équipe suspectée de triche',
      status: 'open',
    });
    createdIds.tournament_disputes.push(dispute.id);

    expect(dispute.status).toBe('open');
    expect(dispute.severity).toBe('major');

    // Admin résout le litige
    const { error } = await supabaseAdmin
      .from('tournament_disputes')
      .update({
        status: 'resolved',
        resolution_note: 'Équipe disqualifiée',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', dispute.id);

    expect(error).toBeNull();

    const { data: resolved } = await supabaseAdmin
      .from('tournament_disputes')
      .select('*')
      .eq('id', dispute.id)
      .single();

    expect(resolved?.status).toBe('resolved');
  });

  // ── ÉTAPE 10 : Notification vainqueur ──
  test('10. Notification envoyée au capitaine vainqueur', async () => {
    const winner = await createTestUser();
    createdIds.users.push(winner.id);

    const tournament = await createTestTournament(winner.id, {
      status: 'completed',
    });
    createdIds.tournaments.push(tournament.id);

    const notif = await createTestNotification(winner.id, {
      type: 'tournament_won',
      title: 'Félicitations !',
      message: `Vous avez gagné ${tournament.name}`,
      data: { tournamentId: tournament.id, prize: 20000 },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.type).toBe('tournament_won');
    expect(notif.user_id).toBe(winner.id);
  });
});
