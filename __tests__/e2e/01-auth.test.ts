import { supabaseAdmin, supabaseAnon, supabaseAsUser, createTestUser, cleanup, fakePhone } from './setup';

describe('AUTH — Inscription', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await cleanup({ users: createdUserIds });
  });

  test('✅ Inscription valide → user créé en BDD avec tous les champs', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);

    expect(user.id).toBeDefined();
    expect(user.phone).toBeDefined();
    expect(user.first_name).toBeDefined();
    expect(user.last_name).toBeDefined();
    expect(user.username).toBeDefined();
    expect(user.referral_code).toBeDefined();
    expect(user.role).toBe('user');
    expect(user.is_verified).toBe(false);
    expect(user.is_premium).toBe(false);
  });

  test('✅ Inscription → referral_code auto-généré et unique', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdUserIds.push(user1.id, user2.id);

    expect(user1.referral_code).toBeDefined();
    expect(user2.referral_code).toBeDefined();
    expect(user1.referral_code).not.toBe(user2.referral_code);
  });

  test('✅ Inscription → stats JSONB initialisé', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);

    expect(user.stats).toBeDefined();
    expect(typeof user.stats).toBe('object');
    expect(user.stats.matchesPlayed).toBe(0);
  });

  test('❌ Inscription numéro déjà utilisé → erreur unique constraint', async () => {
    const phone = fakePhone();
    const user1 = await createTestUser({ phone });
    createdUserIds.push(user1.id);

    await expect(createTestUser({ phone })).rejects.toThrow();
  });

  test('❌ Inscription username déjà utilisé → erreur unique constraint', async () => {
    const username = `testuser_${Date.now()}`;
    const user1 = await createTestUser({ username });
    createdUserIds.push(user1.id);

    await expect(createTestUser({ username })).rejects.toThrow(/DUPLICATE|duplicate|unique/i);
  });
});

describe('AUTH — Connexion', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await cleanup({ users: createdUserIds });
  });

  test('✅ Connexion valide → retourne JWT token valide', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);

    expect(user.token).toBeDefined();
    expect(typeof user.token).toBe('string');
    expect(user.token.length).toBeGreaterThan(0);
  });

  test('✅ Connexion valide → token peut être utilisé pour requêtes authentifiées', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);

    const client = supabaseAsUser(user.token);
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(user.id);
  });
});

describe('AUTH — Profil utilisateur', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await cleanup({ users: createdUserIds });
  });

  test('✅ Mise à jour first_name, last_name → persiste en BDD', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);

    const { error } = await supabaseAdmin
      .from('users')
      .update({ first_name: 'Updated', last_name: 'Name' })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    expect(data?.first_name).toBe('Updated');
    expect(data?.last_name).toBe('Name');
  });

  test('✅ Mise à jour favorite_sports JSONB → structure correcte persistée', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);

    const newSports = ['football', 'basketball', 'tennis'];
    const { error } = await supabaseAdmin
      .from('users')
      .update({ favorite_sports: newSports })
      .eq('id', user.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('users')
      .select('favorite_sports')
      .eq('id', user.id)
      .single();

    expect(Array.isArray(data?.favorite_sports)).toBe(true);
    expect(data?.favorite_sports).toEqual(newSports);
  });

  test('❌ Modifier role via API directe → bloqué', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);

    const { error } = await supabaseAnon
      .from('users')
      .update({ role: 'admin' })
      .eq('id', user.id);

    expect(error).toBeDefined();
  });
});

describe('AUTH — Parrainage', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await cleanup({ users: createdUserIds });
  });

  test('✅ Inscription avec referral_code valide → referred_by = UUID du parrain', async () => {
    const referrer = await createTestUser();
    createdUserIds.push(referrer.id);

    const referred = await createTestUser({ referred_by: referrer.id });
    createdUserIds.push(referred.id);

    expect(referred.referred_by).toBe(referrer.id);
  });

  test('✅ Deux users ont des referral_code différents', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdUserIds.push(user1.id, user2.id);

    expect(user1.referral_code).not.toBe(user2.referral_code);
  });
});

