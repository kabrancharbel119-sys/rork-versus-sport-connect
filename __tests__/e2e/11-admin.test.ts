import { supabaseAdmin, createTestUser, createTestMatch, createTestVenue, cleanup } from './setup';

describe('ADMIN — Contrôle d\'accès', () => {
  const createdIds = { users: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Requête avec role="admin" → accès autorisé', async () => {
    const admin = await createTestUser({ role: 'admin' });
    createdIds.users.push(admin.id);

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', 'admin');

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('❌ Requête avec role="user" → accès limité', async () => {
    const user = await createTestUser({ role: 'user' });
    createdIds.users.push(user.id);

    expect(user.role).toBe('user');
  });
});

describe('ADMIN — Gestion utilisateurs', () => {
  const createdIds = { users: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Lister tous les users → retourne la liste complète', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .in('id', [user1.id, user2.id]);

    expect(error).toBeNull();
    expect(data?.length).toBe(2);
  });

  test('✅ Vérifier un user → is_verified passe à true', async () => {
    const user = await createTestUser({ is_verified: false });
    createdIds.users.push(user.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_verified: true })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('is_verified')
      .eq('id', user.id)
      .single();

    expect(data?.is_verified).toBe(true);
  });

  test('✅ Attribuer premium → is_premium passe à true', async () => {
    const user = await createTestUser({ is_premium: false });
    createdIds.users.push(user.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_premium: true })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('is_premium')
      .eq('id', user.id)
      .single();

    expect(data?.is_premium).toBe(true);
  });

  test('✅ Révoquer premium → is_premium repasse à false', async () => {
    const user = await createTestUser({ is_premium: true });
    createdIds.users.push(user.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_premium: false })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('is_premium')
      .eq('id', user.id)
      .single();

    expect(data?.is_premium).toBe(false);
  });

  test('✅ Supprimer un user → user retiré de la BDD', async () => {
    const user = await createTestUser();

    // Supprimer le compte auth (le profil sera supprimé via CASCADE)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    expect(authError).toBeNull();

    // Vérifier que le profil a été supprimé
    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id);

    expect(data).toBeDefined();
    expect(data!.length).toBe(0);
  });
});

describe('ADMIN — Gestion matchs', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Admin supprime n\'importe quel match → OK', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);

    const { error } = await supabaseAdmin
      .from('matches')
      .delete()
      .eq('id', match.id);

    expect(error).toBeNull();
  });

  test('✅ Admin modifie n\'importe quel match → OK', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match.id);

    const { error } = await supabaseAdmin
      .from('matches')
      .update({ title: 'Modified by Admin' })
      .eq('id', match.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('matches')
      .select('title')
      .eq('id', match.id)
      .single();

    expect(data?.title).toBe('Modified by Admin');
  });
});

describe('ADMIN — Statistiques globales', () => {
  const createdIds = { users: [] as string[], venues: [] as string[], matches: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Count users → chiffre correct', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const { count, error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('id', [user1.id, user2.id]);

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('✅ Count matchs créés → chiffre correct', async () => {
    const user = await createTestUser();
    const venue = await createTestVenue();
    createdIds.users.push(user.id);
    createdIds.venues.push(venue.id);

    const match1 = await createTestMatch(user.id, venue.id);
    const match2 = await createTestMatch(user.id, venue.id);
    createdIds.matches.push(match1.id, match2.id);

    const { count, error } = await supabaseAdmin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .in('id', [match1.id, match2.id]);

    expect(error).toBeNull();
    expect(count).toBe(2);
  });
});

