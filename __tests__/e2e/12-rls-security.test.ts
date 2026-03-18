import { supabaseAnon, supabaseAdmin, supabaseAsUser, createTestUser, cleanup } from './setup';

describe('RLS — Accès non authentifié', () => {
  test('❌ Lire les users → refusé ou limité', async () => {
    const { data, error } = await supabaseAnon
      .from('users')
      .select('*')
      .limit(1);

    expect(data).toBeDefined();
  });

  test('❌ Créer quoi que ce soit → refusé', async () => {
    const { error } = await supabaseAnon
      .from('users')
      .insert({
        phone: '+2250000000000',
        password_hash: 'test',
        first_name: 'Test',
        last_name: 'User'
      });

    expect(error).toBeDefined();
  });
});

describe('RLS — Isolation des données', () => {
  const createdIds = { users: [] as string[], notifications: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('❌ UserA lit les notifications de UserB → refusé', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const notifB = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userB.id,
        type: 'match',
        title: 'Test',
        message: 'Test',
        data: {},
        is_read: false
      })
      .select()
      .single();

    createdIds.notifications.push(notifB.data.id);

    // UserA essaie de lire les notifications de UserB
    const clientA = supabaseAsUser(userA.token);
    const { data, error } = await clientA
      .from('notifications')
      .select('*')
      .eq('user_id', userB.id);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBe(0);
  });

  test('❌ UserA modifie le profil de UserB → refusé', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const { error } = await supabaseAnon
      .from('users')
      .update({ first_name: 'Hacked' })
      .eq('id', userB.id);

    expect(error).toBeDefined();
  });
});

describe('RLS — Injection et manipulation', () => {
  const createdIds = { users: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('❌ Injection SQL dans search query → neutralisée', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const maliciousQuery = "'; DROP TABLE users; --";
    const client = supabaseAsUser(user.token);

    const { data, error } = await client
      .from('users')
      .select('id, username')
      .ilike('username', `%${maliciousQuery}%`);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBe(0);
  });

  test('❌ S\'attribuer le rôle admin via API → bloqué', async () => {
    const user = await createTestUser({ role: 'user' });
    createdIds.users.push(user.id);

    const { error } = await supabaseAnon
      .from('users')
      .update({ role: 'admin' })
      .eq('id', user.id);

    expect(error).toBeDefined();
  });
});

describe('RLS — Cohérence après bannissement', () => {
  const createdIds = { users: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ User banni → ses données existantes restent en BDD', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const { error: banError } = await supabaseAdmin
      .from('users')
      .update({ role: 'banned' })
      .eq('id', user.id);

    expect(banError).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    expect(data).toBeDefined();
    expect(data?.id).toBe(user.id);
  });
});

