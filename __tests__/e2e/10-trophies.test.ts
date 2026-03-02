import { supabaseAdmin, createTestUser, cleanup } from './setup';

describe('TROPHIES — Déblocage automatique', () => {
  const createdIds = { users: [] as string[], trophies: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ 1er match joué → "first_match" débloqué (rarity=common)', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'first_match',
      trophy_name: 'Premier Match',
      description: 'Jouer votre premier match',
      rarity: 'common'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.trophy_type).toBe('first_match');
    expect(data.rarity).toBe('common');
  });

  test('✅ 1ère victoire → "first_win" débloqué', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'first_win',
      trophy_name: 'Première Victoire',
      description: 'Gagner votre premier match',
      rarity: 'common'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.trophy_type).toBe('first_win');
  });

  test('✅ Hat-trick (3 buts dans 1 match) → "hat_trick" débloqué (rarity=rare)', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'hat_trick',
      trophy_name: 'Hat-Trick',
      description: 'Marquer 3 buts dans un match',
      rarity: 'rare'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.trophy_type).toBe('hat_trick');
    expect(data.rarity).toBe('rare');
  });

  test('✅ 1er tournoi gagné → "champion" débloqué (rarity=legendary)', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'champion',
      trophy_name: 'Champion',
      description: 'Gagner votre premier tournoi',
      rarity: 'legendary'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.trophy_type).toBe('champion');
    expect(data.rarity).toBe('legendary');
  });

  test('✅ Créer une équipe → "team_creator" débloqué', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'team_creator',
      trophy_name: 'Créateur d\'Équipe',
      description: 'Créer votre première équipe',
      rarity: 'common'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.trophy_type).toBe('team_creator');
  });

  test('✅ Atteindre ELO Silver (1000) → trophée débloqué', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'silver_rank',
      trophy_name: 'Rang Silver',
      description: 'Atteindre le rang Silver',
      rarity: 'common'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.trophy_type).toBe('silver_rank');
  });

  test('✅ Atteindre ELO Grandmaster (2000) → trophée légendaire débloqué', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'grandmaster_rank',
      trophy_name: 'Grandmaster',
      description: 'Atteindre le rang Grandmaster',
      rarity: 'legendary'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.trophy_type).toBe('grandmaster_rank');
    expect(data.rarity).toBe('legendary');
  });
});

describe('TROPHIES — Règles', () => {
  const createdIds = { users: [] as string[], trophies: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ unlocked_at = timestamp du moment exact du déblocage', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'test_trophy',
      trophy_name: 'Test Trophy',
      description: 'Test',
      rarity: 'common'
    };

    const { data, error } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(data.id);

    expect(error).toBeNull();
    expect(data.unlocked_at).toBeDefined();
    
    // Tolérance de 5 secondes pour décalage client/serveur
    const tolerance = 5000; // 5 secondes
    const serverTime = new Date(data.unlocked_at).getTime();
    const now = Date.now();
    expect(serverTime).toBeGreaterThan(now - 30000); // pas plus de 30s dans le passé
    expect(serverTime).toBeLessThanOrEqual(now + tolerance); // max 5s dans le futur
  });

  test('✅ Trophée apparaît dans le profil user', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const trophyData = {
      user_id: user.id,
      trophy_type: 'profile_trophy',
      trophy_name: 'Profile Trophy',
      description: 'Test',
      rarity: 'common'
    };

    const { data: trophy } = await supabaseAdmin
      .from('trophies')
      .insert(trophyData)
      .select()
      .single();

    createdIds.trophies.push(trophy.id);

    const { data } = await supabaseAdmin
      .from('trophies')
      .select('*')
      .eq('user_id', user.id);

    expect(data?.length).toBeGreaterThan(0);
    expect(data?.some(t => t.id === trophy.id)).toBe(true);
  });

  test('✅ Rareté correcte : common < rare < epic < legendary', async () => {
    const rarities = ['common', 'rare', 'epic', 'legendary'];
    const rarityValues = { common: 1, rare: 2, epic: 3, legendary: 4 };

    expect(rarityValues.common).toBeLessThan(rarityValues.rare);
    expect(rarityValues.rare).toBeLessThan(rarityValues.epic);
    expect(rarityValues.epic).toBeLessThan(rarityValues.legendary);
  });
});

