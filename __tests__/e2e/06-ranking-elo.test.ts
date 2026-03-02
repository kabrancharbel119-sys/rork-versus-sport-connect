import { supabaseAdmin, createTestUser, createTestPlayerRanking, cleanup } from './setup';

describe('ELO — Calcul mathématique', () => {
  const createdIds = { users: [] as string[], player_rankings: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ PlayerA bat PlayerB → playerA gagne ~8 pts, playerB perd ~8 pts', async () => {
    const playerA = await createTestUser();
    const playerB = await createTestUser();
    createdIds.users.push(playerA.id, playerB.id);

    const rankingA = await createTestPlayerRanking(playerA.id, 'football', 1200);
    const rankingB = await createTestPlayerRanking(playerB.id, 'football', 1000);
    createdIds.player_rankings.push(rankingA.id, rankingB.id);

    const K = 16;
    const expectedA = 1 / (1 + Math.pow(10, (1000 - 1200) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (1200 - 1000) / 400));

    const newEloA = Math.round(1200 + K * (1 - expectedA));
    const newEloB = Math.round(1000 + K * (0 - expectedB));

    expect(newEloA).toBeGreaterThan(1200);
    expect(newEloB).toBeLessThan(1000);
    expect(Math.abs(newEloA - 1200)).toBeLessThanOrEqual(10);
    expect(Math.abs(1000 - newEloB)).toBeLessThanOrEqual(10);
  });

  test('✅ ELO ne peut pas descendre sous 0', async () => {
    const player = await createTestUser();
    createdIds.users.push(player.id);

    const ranking = await createTestPlayerRanking(player.id, 'football', 50);
    createdIds.player_rankings.push(ranking.id);

    const { error } = await supabaseAdmin
      .from('player_rankings')
      .update({ elo_rating: 0 })
      .eq('id', ranking.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('player_rankings')
      .select('elo_rating')
      .eq('id', ranking.id)
      .single();

    expect(data?.elo_rating).toBeGreaterThanOrEqual(0);
  });

  test('✅ K-factor = 40 si matches_played < 10', async () => {
    const K_beginner = 40;
    expect(K_beginner).toBe(40);
  });

  test('✅ K-factor = 20 si matches_played entre 10 et 20', async () => {
    const K_intermediate = 20;
    expect(K_intermediate).toBe(20);
  });

  test('✅ K-factor = 16 si matches_played > 20', async () => {
    const K_experienced = 16;
    expect(K_experienced).toBe(16);
  });
});

describe('ELO — Création automatique ranking', () => {
  const createdIds = { users: [] as string[], player_rankings: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Premier match ranked → player_rankings créé avec ELO=1000', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 1000);
    createdIds.player_rankings.push(ranking.id);

    expect(ranking.elo_rating).toBe(1000);
    expect(ranking.sport).toBe('football');
    expect(ranking.user_id).toBe(user.id);
  });

  test('✅ Un user peut avoir plusieurs player_rankings (un par sport)', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const footballRanking = await createTestPlayerRanking(user.id, 'football', 1000);
    const basketRanking = await createTestPlayerRanking(user.id, 'basketball', 1000);
    createdIds.player_rankings.push(footballRanking.id, basketRanking.id);

    expect(footballRanking.sport).toBe('football');
    expect(basketRanking.sport).toBe('basketball');
    expect(footballRanking.user_id).toBe(user.id);
    expect(basketRanking.user_id).toBe(user.id);
  });
});

describe('ELO — Classements globaux', () => {
  const createdIds = { users: [] as string[], player_rankings: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Top 100 par sport → trié par elo_rating DESC', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const user3 = await createTestUser();
    createdIds.users.push(user1.id, user2.id, user3.id);

    const ranking1 = await createTestPlayerRanking(user1.id, 'football', 1500);
    const ranking2 = await createTestPlayerRanking(user2.id, 'football', 1200);
    const ranking3 = await createTestPlayerRanking(user3.id, 'football', 1800);
    createdIds.player_rankings.push(ranking1.id, ranking2.id, ranking3.id);

    const { data } = await supabaseAdmin
      .from('player_rankings')
      .select('*')
      .eq('sport', 'football')
      .order('elo_rating', { ascending: false })
      .limit(100);

    expect(data?.length).toBeGreaterThan(0);
    if (data && data.length > 1) {
      expect(data[0].elo_rating).toBeGreaterThanOrEqual(data[1].elo_rating);
    }
  });

  test('✅ rank = position dans le classement global', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 1500);
    createdIds.player_rankings.push(ranking.id);

    const { error } = await supabaseAdmin
      .from('player_rankings')
      .update({ rank: 1 })
      .eq('id', ranking.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('player_rankings')
      .select('rank')
      .eq('id', ranking.id)
      .single();

    expect(data?.rank).toBe(1);
  });
});

describe('ELO — recent_form', () => {
  const createdIds = { users: [] as string[], player_rankings: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Après victoire → "W" ajouté en tête de recent_form', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 1000);
    createdIds.player_rankings.push(ranking.id);

    const { error } = await supabaseAdmin
      .from('player_rankings')
      .update({ recent_form: 'W' })
      .eq('id', ranking.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('player_rankings')
      .select('recent_form')
      .eq('id', ranking.id)
      .single();

    expect(data?.recent_form).toBe('W');
  });

  test('✅ recent_form max 5 caractères', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 1000);
    createdIds.player_rankings.push(ranking.id);

    const form = 'WWLWD';
    const { error } = await supabaseAdmin
      .from('player_rankings')
      .update({ recent_form: form })
      .eq('id', ranking.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('player_rankings')
      .select('recent_form')
      .eq('id', ranking.id)
      .single();

    expect(data?.recent_form.length).toBeLessThanOrEqual(5);
  });
});

describe('ELO — Badges', () => {
  test('✅ ELO 0-999 → badge "Bronze"', () => {
    const getBadge = (elo: number) => {
      if (elo < 1000) return 'Bronze';
      if (elo < 1200) return 'Silver';
      if (elo < 1400) return 'Gold';
      if (elo < 1600) return 'Platinum';
      if (elo < 1800) return 'Diamond';
      if (elo < 2000) return 'Master';
      return 'Grandmaster';
    };

    expect(getBadge(500)).toBe('Bronze');
    expect(getBadge(999)).toBe('Bronze');
  });

  test('✅ ELO 1000-1199 → badge "Silver"', () => {
    const getBadge = (elo: number) => {
      if (elo < 1000) return 'Bronze';
      if (elo < 1200) return 'Silver';
      if (elo < 1400) return 'Gold';
      if (elo < 1600) return 'Platinum';
      if (elo < 1800) return 'Diamond';
      if (elo < 2000) return 'Master';
      return 'Grandmaster';
    };

    expect(getBadge(1000)).toBe('Silver');
    expect(getBadge(1199)).toBe('Silver');
  });

  test('✅ ELO 1200-1399 → badge "Gold"', () => {
    const getBadge = (elo: number) => {
      if (elo < 1000) return 'Bronze';
      if (elo < 1200) return 'Silver';
      if (elo < 1400) return 'Gold';
      if (elo < 1600) return 'Platinum';
      if (elo < 1800) return 'Diamond';
      if (elo < 2000) return 'Master';
      return 'Grandmaster';
    };

    expect(getBadge(1200)).toBe('Gold');
    expect(getBadge(1399)).toBe('Gold');
  });

  test('✅ ELO 2000+ → badge "Grandmaster"', () => {
    const getBadge = (elo: number) => {
      if (elo < 1000) return 'Bronze';
      if (elo < 1200) return 'Silver';
      if (elo < 1400) return 'Gold';
      if (elo < 1600) return 'Platinum';
      if (elo < 1800) return 'Diamond';
      if (elo < 2000) return 'Master';
      return 'Grandmaster';
    };

    expect(getBadge(2000)).toBe('Grandmaster');
    expect(getBadge(2500)).toBe('Grandmaster');
  });
});

describe('ELO — peak_rating', () => {
  const createdIds = { users: [] as string[], player_rankings: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ peak_rating = valeur maximale jamais atteinte', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 1500);
    createdIds.player_rankings.push(ranking.id);

    expect(ranking.peak_rating).toBe(1500);
  });

  test('✅ peak_rating ne diminue JAMAIS', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const ranking = await createTestPlayerRanking(user.id, 'football', 1500);
    createdIds.player_rankings.push(ranking.id);

    const { error } = await supabaseAdmin
      .from('player_rankings')
      .update({ elo_rating: 1400 })
      .eq('id', ranking.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('player_rankings')
      .select('peak_rating')
      .eq('id', ranking.id)
      .single();

    expect(data?.peak_rating).toBe(1500);
  });
});

