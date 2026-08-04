import { supabaseAdmin, createTestUser, cleanup } from './setup';

describe('NOTIFICATIONS — Création automatique', () => {
  const createdIds = { users: [] as string[], notifications: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Notification type="match" créée correctement', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notificationData = {
      user_id: user.id,
      type: 'match',
      title: 'Nouveau joueur',
      message: 'Un joueur a rejoint votre match',
      data: { matchId: 'test-match-id', matchTitle: 'Test Match' },
      is_read: false
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    createdIds.notifications.push(data.id);

    expect(error).toBeNull();
    expect(data.type).toBe('match');
    expect(data.user_id).toBe(user.id);
  });

  test('✅ Notification type="team" créée correctement', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notificationData = {
      user_id: user.id,
      type: 'team',
      title: 'Invitation équipe',
      message: 'Vous avez été invité à rejoindre une équipe',
      data: { teamId: 'test-team-id', teamName: 'Test Team' },
      is_read: false
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    createdIds.notifications.push(data.id);

    expect(error).toBeNull();
    expect(data.type).toBe('team');
  });

  test('✅ Notification type="tournament" créée correctement', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notificationData = {
      user_id: user.id,
      type: 'tournament',
      title: 'Inscription validée',
      message: 'Votre équipe a été acceptée au tournoi',
      data: { tournamentId: 'test-tournament-id' },
      is_read: false
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdIds.notifications.push(data.id);

    expect(data.type).toBe('tournament');
  });

  test('✅ Notification type="ranking" créée correctement', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notificationData = {
      user_id: user.id,
      type: 'ranking',
      title: 'Nouveau badge',
      message: 'Vous avez atteint le niveau Gold!',
      data: { badge: 'Gold', elo: 1200 },
      is_read: false
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdIds.notifications.push(data.id);

    expect(data.type).toBe('ranking');
  });
});

describe('NOTIFICATIONS — Structure', () => {
  const createdIds = { users: [] as string[], notifications: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Chaque notification a tous les champs requis', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notificationData = {
      user_id: user.id,
      type: 'match',
      title: 'Test',
      message: 'Test message',
      data: { test: 'data' },
      is_read: false
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdIds.notifications.push(data.id);

    expect(data.id).toBeDefined();
    expect(data.user_id).toBe(user.id);
    expect(data.type).toBeDefined();
    expect(data.title).toBeDefined();
    expect(data.message).toBeDefined();
    expect(data.data).toBeDefined();
    expect(data.is_read).toBe(false);
    expect(data.created_at).toBeDefined();
  });

  test('✅ data JSONB contient les métadonnées utiles', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const metadata = {
      matchId: 'match-123',
      matchTitle: 'Football 5v5',
      venue: 'Stade FHB'
    };

    const notificationData = {
      user_id: user.id,
      type: 'match',
      title: 'Match confirmé',
      message: 'Votre match est confirmé',
      data: metadata,
      is_read: false
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdIds.notifications.push(data.id);

    expect(typeof data.data).toBe('object');
    expect(data.data.matchId).toBe('match-123');
    expect(data.data.matchTitle).toBe('Football 5v5');
  });
});

describe('NOTIFICATIONS — Gestion', () => {
  const createdIds = { users: [] as string[], notifications: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Marquer une notification comme lue → read = true', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notificationData = {
      user_id: user.id,
      type: 'match',
      title: 'Test',
      message: 'Test',
      data: {},
      is_read: false
    };

    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(notification).toBeDefined();
    createdIds.notifications.push(notification.id);

    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id);

    expect(updateError).toBeNull();

    const { data } = await supabaseAdmin
      .from('notifications')
      .select('is_read')
      .eq('id', notification.id)
      .single();

    expect(data?.is_read).toBe(true);
  });

  test('✅ Supprimer une notification → retirée de la BDD', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notificationData = {
      user_id: user.id,
      type: 'match',
      title: 'Test',
      message: 'Test',
      data: {},
      is_read: false
    };

    const { data: notification, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(notification).toBeDefined();

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notification.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', notification.id)
      .single();

    expect(data).toBeNull();
  });

  test('✅ Récupérer uniquement non lues → filtre read=false fonctionnel', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const unreadNotif = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'match',
        title: 'Unread',
        message: 'Unread',
        data: {},
        is_read: false
      })
      .select()
      .single();

    expect(unreadNotif.error).toBeNull();
    expect(unreadNotif.data).toBeDefined();

    const readNotif = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'match',
        title: 'Read',
        message: 'Read',
        data: {},
        is_read: true
      })
      .select()
      .single();

    expect(readNotif.error).toBeNull();
    expect(readNotif.data).toBeDefined();
    createdIds.notifications.push(unreadNotif.data.id, readNotif.data.id);

    const { data } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false);

    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every(n => n.is_read === false)).toBe(true);
  });

  test('✅ Notifications triées par created_at DESC', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const notif1 = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'match',
        title: 'First',
        message: 'First',
        data: {},
        is_read: false
      })
      .select()
      .single();

    expect(notif1.error).toBeNull();
    expect(notif1.data).toBeDefined();

    await new Promise(resolve => setTimeout(resolve, 100));

    const notif2 = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'match',
        title: 'Second',
        message: 'Second',
        data: {},
        is_read: false
      })
      .select()
      .single();

    expect(notif2.error).toBeNull();
    expect(notif2.data).toBeDefined();
    createdIds.notifications.push(notif1.data.id, notif2.data.id);

    const { data } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    expect(data?.length).toBe(2);
    expect(new Date(data![0].created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(data![1].created_at).getTime()
    );
  });
});

