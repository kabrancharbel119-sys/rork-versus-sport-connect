import {
  supabaseAdmin,
  createTestUser,
  createTestTeam,
  createTestTeamPost,
  createTestTeamPhoto,
  createTestCMAssignment,
  createTestDissolutionRequest,
  createTestNotification,
  cleanup
} from './setup';

describe('FLOW TEAM CM — Création → CM → Posts → Photos → Dissolution', () => {
  const createdIds = {
    users: [] as string[],
    teams: [] as string[],
    team_posts: [] as string[],
    team_photos: [] as string[],
    team_cm_assignments: [] as string[],
    team_dissolution_requests: [] as string[],
    notifications: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Création de team ──
  test('1. Capitaine crée une team → membres initiaux = [capitain]', async () => {
    const captain = await createTestUser();
    createdIds.users.push(captain.id);

    const team = await createTestTeam(captain.id, {
      name: 'FC Test CM',
      sport: 'football',
      level: 'intermediate',
      is_recruiting: true,
    });
    createdIds.teams.push(team.id);

    expect(team.captain_id).toBe(captain.id);
    expect(team.members).toHaveLength(1);
    expect(team.members[0].role).toBe('captain');
    expect(team.is_recruiting).toBe(true);
  });

  // ── ÉTAPE 2 : Ajout de membres ──
  test('2. Ajout de 2 membres → members contient 3 joueurs', async () => {
    const captain = await createTestUser();
    const m1 = await createTestUser();
    const m2 = await createTestUser();
    createdIds.users.push(captain.id, m1.id, m2.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const updatedMembers = [
      ...team.members,
      { userId: m1.id, role: 'member', joinedAt: new Date().toISOString() },
      { userId: m2.id, role: 'member', joinedAt: new Date().toISOString() },
    ];

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ members: updatedMembers })
      .eq('id', team.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('teams')
      .select('members')
      .eq('id', team.id)
      .single();

    expect(data?.members).toHaveLength(3);
  });

  // ── ÉTAPE 3 : Assignation d'un CM ──
  test('3. Capitaine assigne un CM avec permissions personnalisées', async () => {
    const captain = await createTestUser();
    const cm = await createTestUser();
    createdIds.users.push(captain.id, cm.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    // Ajouter le CM comme membre d'abord
    const updatedMembers = [
      ...team.members,
      { userId: cm.id, role: 'cm', joinedAt: new Date().toISOString() },
    ];

    await supabaseAdmin
      .from('teams')
      .update({ members: updatedMembers })
      .eq('id', team.id);

    // Assigner le CM
    const cmAssignment = await createTestCMAssignment(team.id, cm.id, captain.id, {
      permissions: {
        can_post: true,
        can_delete_posts: false,
        can_manage_photos: true,
        can_pin_posts: true,
        can_manage_members: false,
      },
    });
    createdIds.team_cm_assignments.push(cmAssignment.id);

    expect(cmAssignment.team_id).toBe(team.id);
    expect(cmAssignment.user_id).toBe(cm.id);
    expect(cmAssignment.assigned_by).toBe(captain.id);
    expect(cmAssignment.status).toBe('active');
    expect(cmAssignment.permissions.can_post).toBe(true);
    expect(cmAssignment.permissions.can_manage_photos).toBe(true);
  });

  // ── ÉTAPE 4 : CM crée un post ──
  test('4. CM crée un team_post → persisté en BDD', async () => {
    const captain = await createTestUser();
    const cm = await createTestUser();
    createdIds.users.push(captain.id, cm.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const post = await createTestTeamPost(team.id, cm.id, {
      content: 'Entraînement ce soir à 18h !',
    });
    createdIds.team_posts.push(post.id);

    expect(post.team_id).toBe(team.id);
    expect(post.author_id).toBe(cm.id);
    expect(post.content).toBe('Entraînement ce soir à 18h !');
  });

  // ── ÉTAPE 5 : Like d'un team post ──
  test('5. Membre like un team_post → team_post_likes créé', async () => {
    const captain = await createTestUser();
    const member = await createTestUser();
    createdIds.users.push(captain.id, member.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const post = await createTestTeamPost(team.id, captain.id);
    createdIds.team_posts.push(post.id);

    const { data: like, error } = await supabaseAdmin
      .from('team_post_likes')
      .insert({ post_id: post.id, user_id: member.id })
      .select()
      .single();

    expect(error).toBeNull();
    expect(like.post_id).toBe(post.id);
    expect(like.user_id).toBe(member.id);
  });

  // ── ÉTAPE 6 : Commentaire sur team post ──
  test('6. Membre commente un team_post → team_post_comments créé', async () => {
    const captain = await createTestUser();
    const member = await createTestUser();
    createdIds.users.push(captain.id, member.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const post = await createTestTeamPost(team.id, captain.id);
    createdIds.team_posts.push(post.id);

    const { data: comment, error } = await supabaseAdmin
      .from('team_post_comments')
      .insert({
        post_id: post.id,
        user_id: member.id,
        content: 'Je serai présent !',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(comment.content).toBe('Je serai présent !');
  });

  // ── ÉTAPE 7 : Ajout de photo ──
  test('7. CM ajoute une photo à la galerie → team_photos créé', async () => {
    const captain = await createTestUser();
    const cm = await createTestUser();
    createdIds.users.push(captain.id, cm.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const photo = await createTestTeamPhoto(team.id, cm.id, {
      image_url: 'https://example.com/team-photo-1.jpg',
      caption: 'Photo de l\'équipe après la victoire',
    });
    createdIds.team_photos.push(photo.id);

    expect(photo.team_id).toBe(team.id);
    expect(photo.user_id).toBe(cm.id);
    expect(photo.caption).toContain('victoire');
  });

  // ── ÉTAPE 8 : Suppression de photo ──
  test('8. Capitaine supprime une photo de la galerie', async () => {
    const captain = await createTestUser();
    createdIds.users.push(captain.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const photo = await createTestTeamPhoto(team.id, captain.id);
    createdIds.team_photos.push(photo.id);

    const { error } = await supabaseAdmin
      .from('team_photos')
      .delete()
      .eq('id', photo.id);

    expect(error).toBeNull();

    const { data: deleted } = await supabaseAdmin
      .from('team_photos')
      .select('id')
      .eq('id', photo.id)
      .single();

    expect(deleted).toBeNull();
  });

  // ── ÉTAPE 9 : Demande de dissolution ──
  test('9. Capitaine demande la dissolution → request créée avec status="pending"', async () => {
    const captain = await createTestUser();
    createdIds.users.push(captain.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const dissolution = await createTestDissolutionRequest(team.id, captain.id, {
      reason: 'Équipe inactive depuis 6 mois',
    });
    createdIds.team_dissolution_requests.push(dissolution.id);

    expect(dissolution.status).toBe('pending');
    expect(dissolution.reason).toContain('inactive');
  });

  // ── ÉTAPE 10 : Admin approuve la dissolution ──
  test('10. Admin approuve dissolution → status="approved" → team marquée dissoute', async () => {
    const captain = await createTestUser();
    const admin = await createTestUser({ role: 'admin' });
    createdIds.users.push(captain.id, admin.id);

    const team = await createTestTeam(captain.id);
    createdIds.teams.push(team.id);

    const dissolution = await createTestDissolutionRequest(team.id, captain.id);
    createdIds.team_dissolution_requests.push(dissolution.id);

    // Admin approuve
    const { error: approveError } = await supabaseAdmin
      .from('team_dissolution_requests')
      .update({
        status: 'approved',
        admin_note: 'Dissolution approuvée',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', dissolution.id);

    expect(approveError).toBeNull();

    // Team marquée comme dissoute
    const { error: teamError } = await supabaseAdmin
      .from('teams')
      .update({ is_recruiting: false, is_active: false })
      .eq('id', team.id);

    expect(teamError).toBeNull();

    const { data: approved } = await supabaseAdmin
      .from('team_dissolution_requests')
      .select('*')
      .eq('id', dissolution.id)
      .single();

    expect(approved?.status).toBe('approved');
  });

  // ── ÉTAPE 11 : Notification de promotion CM ──
  test('11. CM reçoit notification de promotion', async () => {
    const captain = await createTestUser();
    const cm = await createTestUser();
    createdIds.users.push(captain.id, cm.id);

    const team = await createTestTeam(captain.id, { name: 'FC Notif CM' });
    createdIds.teams.push(team.id);

    const notif = await createTestNotification(cm.id, {
      type: 'cm_promotion',
      title: 'Vous êtes maintenant Community Manager',
      message: `Vous avez été promu CM de ${team.name}`,
      data: { teamId: team.id, teamName: team.name },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.type).toBe('cm_promotion');
    expect(notif.user_id).toBe(cm.id);
  });
});
