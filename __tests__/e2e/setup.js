const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: '.env.test' });

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase test credentials in .env.test');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function supabaseAsUser(token) {
  // Créer un nouveau client avec le JWT dans le header Authorization
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}` 
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  return client;
}

// Générateurs de données simples
function fakePhone() {
  // Utiliser timestamp + random pour éviter les collisions entre tests
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `+225${timestamp}${random}`;
}

function fakeUUID() {
  return crypto.randomUUID();
}

function randomString(length = 8) {
  return Math.random().toString(36).substring(2, 2 + length);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createTestUser(overrides = {}) {
  const phone = overrides.phone || fakePhone();
  const password = overrides.password || 'TestPassword123!';
  const email = overrides.email || `test_${Date.now()}_${Math.random().toString(36).slice(2)}@vstest.com`;
  const username = overrides.username || `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // 1. Créer le user via Admin API (pas de rate limit)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      phone,
      username
    }
  });
  if (authError) throw new Error('createUser failed: ' + authError.message);
  const userId = authData.user.id;

  // 2. Insérer le profil dans la table users
  // Générer un password_hash simple pour les tests (bcrypt-like format)
  const passwordHash = `$2a$10$${Buffer.from(password).toString('base64').slice(0, 53)}`;
  
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: userId,
      phone,
      email,
      username,
      full_name: overrides.full_name || `${overrides.first_name || 'Test'} ${overrides.last_name || 'User'}`,
      password_hash: passwordHash,
      bio: overrides.bio !== undefined ? overrides.bio : 'Test user bio',
      city: overrides.city || 'Abidjan',
      country: overrides.country || 'Côte d\'Ivoire',
      role: overrides.role || 'user',
      is_verified: overrides.is_verified !== undefined ? overrides.is_verified : false,
      is_premium: overrides.is_premium !== undefined ? overrides.is_premium : false,
      referral_code: overrides.referral_code || `REF${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      stats: overrides.stats || {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        goalsScored: 0,
        assists: 0,
        mvpAwards: 0,
        fairPlayScore: 5.0,
        tournamentWins: 0,
        totalCashPrize: 0
      },
      sports: overrides.sports || overrides.favorite_sports || []
    })
    .select()
    .single();
  if (profileError) {
    if (profileError.code === '23505') {
      throw new Error('DUPLICATE_PHONE_OR_USERNAME: ' + profileError.message);
    }
    throw new Error('createProfile failed: ' + profileError.message);
  }

  // 3. Obtenir un vrai JWT via signInWithPassword (fiable pour les tests RLS)
  let token = '';
  try {
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });
    if (!signInError && signInData?.session?.access_token) {
      token = signInData.session.access_token;
    }
  } catch (e) {
    // fallback : token factice (ok pour les tests qui n'utilisent pas supabaseAsUser)
  }

  if (!token) {
    token = `test_token_${userId}_${Date.now()}`;
  }

  return {
    ...profileData,
    password,
    token
  };
}

async function createTestUsers(count, overrides = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800)); // 800ms entre chaque
    users.push(await createTestUser(overrides));
  }
  return users;
}

async function createTestVenue(overrides = {}) {
  const rand = randomString(6);
  const venueData = {
    name: overrides.name || `Stadium ${rand}`,
    address: overrides.address || `${randomInt(1, 999)} Test Street`,
    city: overrides.city || 'Abidjan',
    sport: overrides.sport || { sports: ['football', 'basketball'] },
    price_per_hour: overrides.price_per_hour || randomInt(5000, 50000),
    rating: overrides.rating || 4.0,
    amenities: overrides.amenities || ['parking', 'vestiaires', 'eclairage'],
    latitude: overrides.latitude || 5.3,
    longitude: overrides.longitude || -4.0,
    images: overrides.images || ['https://example.com/venue1.jpg'],
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('venues')
    .insert(venueData)
    .select()
    .single();

  if (error) throw new Error('createTestVenue failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestVenue: no data returned');
  return data;
}

async function createTestMatch(userId, venueId, overrides = {}) {
  // Validation stricte : s'assurer que venueId est un UUID string
  const actualVenueId = typeof venueId === 'object' ? venueId.id : venueId;
  if (!actualVenueId || typeof actualVenueId !== 'string') {
    throw new Error(`createTestMatch: venueId invalide: ${JSON.stringify(venueId)}`);
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error(`createTestMatch: userId invalide: ${JSON.stringify(userId)}`);
  }

  const dateTime = overrides.date_time || new Date(Date.now() + 86400000).toISOString();
  
  // Validation stricte avant insertion (comme dans lib/api/matches.ts)
  const entryFee = overrides.entry_fee !== undefined ? overrides.entry_fee : 0;
  const maxPlayers = overrides.max_players !== undefined ? overrides.max_players : 10;
  const prize = overrides.prize !== undefined ? overrides.prize : 0;
  
  if (entryFee !== null && entryFee < 0) {
    throw new Error('VALIDATION_ERROR: entry_fee cannot be negative');
  }
  if (maxPlayers !== null && maxPlayers <= 0) {
    throw new Error('VALIDATION_ERROR: max_players must be greater than 0');
  }
  if (prize !== null && prize < 0) {
    throw new Error('VALIDATION_ERROR: prize cannot be negative');
  }
  
  const matchData = {
    sport: overrides.sport || 'football',
    format: overrides.format || '5v5',
    type: overrides.type || 'friendly',
    status: overrides.status || 'open',
    venue_id: actualVenueId,
    venue_data: overrides.venue_data || { id: actualVenueId, name: 'Test Venue' },
    date_time: dateTime,
    duration: overrides.duration || 90,
    level: overrides.level || 'intermediate',
    ambiance: overrides.ambiance || 'casual',
    max_players: maxPlayers,
    registered_players: overrides.registered_players || [],
    score_home: overrides.score_home !== undefined ? overrides.score_home : null,
    score_away: overrides.score_away !== undefined ? overrides.score_away : null,
    created_by: userId,
    entry_fee: entryFee,
    prize: prize,
    needs_players: overrides.needs_players !== undefined ? overrides.needs_players : true,
    location_lat: overrides.location_lat || 5.3,
    location_lng: overrides.location_lng || -4.0,
    player_stats: overrides.player_stats || [],
    home_team_id: overrides.home_team_id || null,
    away_team_id: overrides.away_team_id || null,
    tournament_id: overrides.tournament_id || null,
    round_label: overrides.round_label || null,
    mvp_id: overrides.mvp_id || null
  };

  const { data, error } = await supabaseAdmin
    .from('matches')
    .insert(matchData)
    .select()
    .single();

  if (error) throw new Error('createTestMatch failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestMatch: no data returned');
  return data;
}

async function createTestTeam(captainId, overrides = {}) {
  const rand = randomString(6);
  const teamData = {
    name: overrides.name || `Team ${rand} FC`,
    logo: overrides.logo || 'https://example.com/logo.png',
    sport: overrides.sport || 'football',
    format: overrides.format || '5v5',
    level: overrides.level || 'intermediate',
    ambiance: overrides.ambiance || 'casual',
    city: overrides.city || 'Abidjan',
    country: overrides.country || 'Côte d\'Ivoire',
    description: overrides.description || 'Test team description',
    captain_id: captainId,
    co_captain_ids: overrides.co_captain_ids || [],
    members: overrides.members || [{ userId: captainId, role: 'captain', joinedAt: new Date().toISOString() }],
    max_members: overrides.max_members || 20,
    stats: overrides.stats || {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      streak: 0,
      trophies: []
    },
    reputation: overrides.reputation || 0,
    is_recruiting: overrides.is_recruiting !== undefined ? overrides.is_recruiting : true,
    join_requests: overrides.join_requests || [],
    custom_roles: overrides.custom_roles || {},
    location_lat: overrides.location_lat || 5.3,
    location_lng: overrides.location_lng || -4.0,
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('teams')
    .insert(teamData)
    .select()
    .single();

  if (error) throw new Error('createTestTeam failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTeam: no data returned');
  return data;
}

async function createTestTournament(userId, overrides = {}) {
  const rand = randomString(6);
  const tournamentData = {
    name: overrides.name || `Tournament ${rand}`,
    description: overrides.description || 'Test tournament description',
    sport: overrides.sport || 'football',
    format: overrides.format || '5v5',
    type: overrides.type || 'knockout',
    status: overrides.status || 'draft',
    level: overrides.level || 'intermediate',
    max_teams: overrides.max_teams || 8,
    registered_teams: overrides.registered_teams || [],
    entry_fee: overrides.entry_fee || 0,
    prize_pool: overrides.prize_pool || 0,
    prizes: overrides.prizes || { first: 0, second: 0, third: 0 },
    venue_data: overrides.venue_data || { name: 'Test Venue' },
    start_date: overrides.start_date || new Date(Date.now() + 86400000).toISOString(),
    end_date: overrides.end_date || new Date(Date.now() + 172800000).toISOString(),
    match_ids: overrides.match_ids || [],
    winner_id: overrides.winner_id || null,
    sponsor_name: overrides.sponsor_name || null,
    sponsor_logo: overrides.sponsor_logo || null,
    managers: overrides.managers || [],
    created_by: userId,
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .insert(tournamentData)
    .select()
    .single();

  if (error) throw new Error('createTestTournament failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTournament: no data returned');
  return data;
}

async function createTestPlayerRanking(userId, sport, elo = 1000) {
  const rankingData = {
    user_id: userId,
    sport,
    elo_rating: elo,
    rank: 1,
    matches_played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    win_rate: 0,
    recent_form: '',
    peak_rating: elo,
    achievements: []
  };

  const { data, error } = await supabaseAdmin
    .from('player_rankings')
    .insert(rankingData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function cleanup(ids) {
  const tables = [
    { name: 'match_events', key: 'match_events' },
    { name: 'live_match_stats', key: 'live_match_stats' },
    { name: 'chat_messages', key: 'chat_messages' },
    { name: 'notifications', key: 'notifications' },
    { name: 'trophies', key: 'trophies' },
    { name: 'player_rankings', key: 'player_rankings' },
    { name: 'team_rankings', key: 'team_rankings' },
    { name: 'matches', key: 'matches' },
    { name: 'tournaments', key: 'tournaments' },
    { name: 'teams', key: 'teams' },
    { name: 'venues', key: 'venues' },
    { name: 'users', key: 'users' }
  ];

  for (const table of tables) {
    const idsToDelete = ids[table.key];
    if (idsToDelete && idsToDelete.length > 0) {
      await supabaseAdmin
        .from(table.name)
        .delete()
        .in('id', idsToDelete);
    }
  }
}

module.exports = {
  supabaseAdmin,
  supabaseAnon,
  supabaseAsUser,
  createTestUser,
  createTestUsers,
  createTestVenue,
  createTestMatch,
  createTestTeam,
  createTestTournament,
  createTestPlayerRanking,
  cleanup,
  fakePhone
};
