import {
  supabaseAdmin,
  createTestUser,
  createTestTeam,
  createTestTournament,
  createTestPost,
  createTestPostReport,
  createTestDissolutionRequest,
  createTestPayoutRequest,
  createTestDispute,
  createTestNotification,
  cleanup
} from './setup';

describe('FLOW ADMIN — Ban → Dissolution → Reports → Payouts → Disputes', () => {
  const createdIds = {
    users: [] as string[],
    teams: [] as string[],
    tournaments: [] as string[],
    posts: [] as string[],
    post_reports: [] as string[],
    team_dissolution_requests: [] as string[],
    tournament_payout_requests: [] as string[],
    tournament_disputes: [] as string[],
    notifications: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Ban user ──
  test('1. Admin ban un utilisateur → is_banned=true + ban_reason + banned_until', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const badUser = await createTestUser();
    createdIds.users.push(admin.id, badUser.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        is_banned: true,
        ban_reason: 'Comportement abusif répété',
        banned_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .eq('id', badUser.id);

    expect(error).toBeNull();

    const { data: banned } = await supabaseAdmin
      .from('users')
      .select('is_banned, ban_reason, banned_until')
      .eq('id', badUser.id)
      .single();

    expect(banned?.is_banned).toBe(true);
    expect(banned?.ban_reason).toContain('abusif');
    expect(banned?.banned_until).toBeDefined();
  });

  // ── ÉTAPE 2 : Unban user ──
  test('2. Admin unban → is_banned=false + champs nettoyés', async () => {
    const user = await createTestUser({ is_banned: true, ban_reason: 'Test ban' });
    createdIds.users.push(user.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        is_banned: false,
        ban_reason: null,
        banned_until: null,
      })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data: unbanned } = await supabaseAdmin
      .from('users')
      .select('is_banned, ban_reason')
      .eq('id', user.id)
      .single();

    expect(unbanned?.is_banned).toBe(false);
    expect(unbanned?.ban_reason).toBeNull();
  });

  // ── ÉTAPE 3 : Approuver dissolution de team ──
  test('3. Admin approuve dissolution → status="approved" + admin_note', async () => {
    const captain = await createTestUser();
    const admin = await createTestUser({ role: 'admin' });
    createdIds.users.push(captain.id, admin.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const dissolution = await createTestDissolutionRequest(team.id, captain.id, {
      reason: 'Plus de joueurs actifs',
    });
    createdIds.team_dissolution_requests.push(dissolution.id);

    const { error } = await supabaseAdmin
      .from('team_dissolution_requests')
      .update({
        status: 'approved',
        admin_note: 'Approuvé après vérification',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', dissolution.id);

    expect(error).toBeNull();

    const { data: approved } = await supabaseAdmin
      .from('team_dissolution_requests')
      .select('*')
      .eq('id', dissolution.id)
      .single();

    expect(approved?.status).toBe('approved');
    expect(approved?.admin_note).toContain('Approuvé');
  });

  // ── ÉTAPE 4 : Rejeter dissolution ──
  test('4. Admin rejette dissolution → status="rejected"', async () => {
    const captain = await createTestUser();
    const admin = await createTestUser({ role: 'admin' });
    createdIds.users.push(captain.id, admin.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const dissolution = await createTestDissolutionRequest(team.id, captain.id);
    createdIds.team_dissolution_requests.push(dissolution.id);

    const { error } = await supabaseAdmin
      .from('team_dissolution_requests')
      .update({
        status: 'rejected',
        admin_note: 'Team encore active',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', dissolution.id);

    expect(error).toBeNull();

    const { data: rejected } = await supabaseAdmin
      .from('team_dissolution_requests')
      .select('status, admin_note')
      .eq('id', dissolution.id)
      .single();

    expect(rejected?.status).toBe('rejected');
  });

  // ── ÉTAPE 5 : Gérer un signalement de post ──
  test('5. Admin résout un signalement de post → status="reviewed"', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const admin = await createTestUser({ role: 'admin' });
    createdIds.users.push(author.id, reporter.id, admin.id);

    const post = await createTestPost(author.id, { content: 'Contenu signalé' });
    createdIds.posts.push(post.id);

    const report = await createTestPostReport(post.id, reporter.id, {
      reason: 'Harcèlement',
    });
    createdIds.post_reports.push(report.id);

    // Admin résout
    const { error } = await supabaseAdmin
      .from('post_reports')
      .update({
        status: 'reviewed',
        admin_note: 'Avertissement envoyé à l\'auteur',
      })
      .eq('id', report.id);

    expect(error).toBeNull();

    const { data: resolved } = await supabaseAdmin
      .from('post_reports')
      .select('*')
      .eq('id', report.id)
      .single();

    expect(resolved?.status).toBe('reviewed');
  });

  // ── ÉTAPE 6 : Admin supprime un post signalé ──
  test('6. Admin supprime un post signalé → post supprimé', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    createdIds.users.push(author.id, reporter.id);

    const post = await createTestPost(author.id, { content: 'Post à supprimer' });
    createdIds.posts.push(post.id);

    const report = await createTestPostReport(post.id, reporter.id, {
      reason: 'Contenu illégal',
    });
    createdIds.post_reports.push(report.id);

    // Marquer le report comme resolved avec suppression
    await supabaseAdmin
      .from('post_reports')
      .update({ status: 'reviewed', admin_note: 'Post supprimé' })
      .eq('id', report.id);

    // Supprimer le post
    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', post.id);

    expect(error).toBeNull();

    const { data: deleted } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', post.id)
      .single();

    expect(deleted).toBeNull();
  });

  // ── ÉTAPE 7 : Approuver une demande de payout ──
  test('7. Admin approuve payout → status="approved" + disbursement_status', async () => {
    const organizer = await createTestUser();
    const admin = await createTestUser({ role: 'admin' });
    createdIds.users.push(organizer.id, admin.id);

    const tournament = await createTestTournament(organizer.id, { status: 'completed' });
    createdIds.tournaments.push(tournament.id);

    const payout = await createTestPayoutRequest(tournament.id, organizer.id, {
      requested_amount: 30000,
      purpose_category: 'venue',
    });
    createdIds.tournament_payout_requests.push(payout.id);

    const { error } = await supabaseAdmin
      .from('tournament_payout_requests')
      .update({
        status: 'approved',
        admin_note: 'Paiement terrain confirmé',
        disbursement_status: 'sent_to_venue',
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
    expect(approved?.disbursement_status).toBe('sent_to_venue');
  });

  // ── ÉTAPE 8 : Rejeter une demande de payout ──
  test('8. Admin rejette payout → status="rejected" + admin_note', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const payout = await createTestPayoutRequest(tournament.id, organizer.id);
    createdIds.tournament_payout_requests.push(payout.id);

    const { error } = await supabaseAdmin
      .from('tournament_payout_requests')
      .update({
        status: 'rejected',
        admin_note: 'Justificatifs insuffisants',
      })
      .eq('id', payout.id);

    expect(error).toBeNull();

    const { data: rejected } = await supabaseAdmin
      .from('tournament_payout_requests')
      .select('status, admin_note')
      .eq('id', payout.id)
      .single();

    expect(rejected?.status).toBe('rejected');
  });

  // ── ÉTAPE 9 : Résoudre un litige ──
  test('9. Admin résout un litige → status="resolved" + resolution', async () => {
    const organizer = await createTestUser();
    const reporter = await createTestUser();
    createdIds.users.push(organizer.id, reporter.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const dispute = await createTestDispute(tournament.id, reporter.id, {
      severity: 'major',
      reason: 'Triche organisée',
    });
    createdIds.tournament_disputes.push(dispute.id);

    const { error } = await supabaseAdmin
      .from('tournament_disputes')
      .update({
        status: 'resolved',
        resolution_note: 'Équipe disqualifiée, résultats annulés',
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
    expect(resolved?.resolution_note).toContain('disqualifiée');
  });

  // ── ÉTAPE 10 : Notification de ban envoyée ──
  test('10. User banni reçoit notification de ban', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notif = await createTestNotification(user.id, {
      type: 'account_banned',
      title: 'Compte suspendu',
      message: 'Votre compte a été suspendu pour 7 jours',
      data: { duration: '7d', reason: 'Comportement abusif' },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.type).toBe('account_banned');
    expect(notif.user_id).toBe(user.id);
  });

  // ── ÉTAPE 11 : Admin liste tous les signalements en attente ──
  test('11. Admin récupère tous les signalements pending → liste non vide', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    createdIds.users.push(author.id, reporter.id);

    const post = await createTestPost(author.id);
    createdIds.posts.push(post.id);

    const report = await createTestPostReport(post.id, reporter.id, { status: 'pending' });
    createdIds.post_reports.push(report.id);

    const { data: pendingReports, error } = await supabaseAdmin
      .from('post_reports')
      .select('*')
      .eq('status', 'pending');

    expect(error).toBeNull();
    expect(pendingReports).toBeDefined();
    expect(pendingReports!.length).toBeGreaterThan(0);
  });
});
