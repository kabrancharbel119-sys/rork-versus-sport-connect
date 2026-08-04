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
      referred_by: overrides.referred_by || null,
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

  // 3. Obtenir un vrai JWT via signInWithPassword (avec retry pour rate limiting)
  let token = '';
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) {
        if (signInError.message.includes('rate limit') && attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        console.warn('[setup] signInWithPassword failed for', email, ':', signInError.message);
      } else if (signInData?.session?.access_token) {
        token = signInData.session.access_token;
        break;
      }
    } catch (e) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      console.warn('[setup] signInWithPassword threw for', email, ':', e.message);
    }
    break;
  }

  if (!token) {
    // Fallback token factice : ne PAS l'utiliser avec supabaseAsUser(), ce n'est pas un JWT valide
    // (cause "Expected 3 parts in JWT; got 1" sur les tests RLS). Sert uniquement de valeur non-vide.
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
    match_type: overrides.match_type || overrides.type || 'friendly',
    title: overrides.title || 'Test Match',
    status: overrides.status || 'open',
    venue_id: actualVenueId,
    venue_data: overrides.venue_data || { id: actualVenueId, name: 'Test Venue' },
    date_time: dateTime,
    start_time: overrides.start_time || dateTime,
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
    is_recruiting: overrides.is_recruiting !== undefined ? overrides.is_recruiting : true,
    join_requests: overrides.join_requests || [],
    custom_roles: overrides.custom_roles || [],
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
    status: overrides.status || 'registration',
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
    elo_rating: elo,
    previous_elo_rating: elo,
    elo_change: 0,
    rank: 1,
    previous_rank: 1,
    rank_change: 0,
    stats: {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      totalGoals: 0,
      totalAssists: 0,
      averageRating: 0,
      currentWinStreak: 0,
      longestWinStreak: 0,
      currentLossStreak: 0,
      rankedMatches: 0,
      rankedWins: 0,
      rankedLosses: 0,
      recentForm: [],
      recentPerformance: 50
    },
    sport_rankings: { [sport]: { elo: elo, rank: 1 } },
    achievements: [],
    badges: []
  };

  const { data, error } = await supabaseAdmin
    .from('player_rankings')
    .insert(rankingData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function createTestChatRoom(overrides = {}) {
  const roomData = {
    name: overrides.name || `Test Room ${randomString(6)}`,
    type: overrides.type || 'general',
    team_id: overrides.team_id || null,
    participants: overrides.participants || [],
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .insert(roomData)
    .select()
    .single();

  if (error) throw new Error('createTestChatRoom failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestChatRoom: no data returned');
  return data;
}

async function createTestBooking(userId, venueId, overrides = {}) {
  const date = overrides.date || new Date().toISOString().split('T')[0];
  const bookingData = {
    venue_id: venueId,
    user_id: userId,
    date,
    start_time: overrides.start_time || '18:00',
    end_time: overrides.end_time || '20:00',
    total_price: overrides.total_price || 10000,
    status: overrides.status || 'pending',
    payment_status: overrides.payment_status || 'not_required',
    booking_code: overrides.booking_code || `BK-${randomString(8).toUpperCase()}`,
    check_in_token: overrides.check_in_token || crypto.randomUUID(),
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .insert(bookingData)
    .select()
    .single();

  if (error) throw new Error('createTestBooking failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestBooking: no data returned');
  return data;
}

async function createTestTicketType(eventType, eventId, creatorId, overrides = {}) {
  const ticketTypeData = {
    event_type: eventType,
    event_id: eventId,
    name: overrides.name || `Billet ${randomString(6)}`,
    description: overrides.description || 'Billet standard',
    price: overrides.price || 2000,
    quantity_total: overrides.quantity_total || 100,
    quantity_sold: overrides.quantity_sold || 0,
    max_per_user: overrides.max_per_user || 4,
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    created_by: creatorId,
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('ticket_types')
    .insert(ticketTypeData)
    .select()
    .single();

  if (error) throw new Error('createTestTicketType failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTicketType: no data returned');
  return data;
}

async function createTestTicket(ticketTypeId, eventType, eventId, buyerId, overrides = {}) {
  const ticketData = {
    ticket_type_id: ticketTypeId,
    event_type: eventType,
    event_id: eventId,
    buyer_id: buyerId,
    price_paid: overrides.price_paid || 2000,
    status: overrides.status || 'valid',
    ticket_code: overrides.ticket_code || `TCK-${randomString(10).toUpperCase()}`,
    qr_token: overrides.qr_token || crypto.randomUUID(),
    payment_transaction_id: overrides.payment_transaction_id || `PAY-${randomString(12)}`,
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert(ticketData)
    .select()
    .single();

  if (error) throw new Error('createTestTicket failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTicket: no data returned');
  return data;
}

async function createTestPost(authorId, overrides = {}) {
  const postData = {
    author_id: authorId,
    content: overrides.content || `Test post ${randomString(8)}`,
    images: overrides.images || [],
    is_auto_generated: overrides.is_auto_generated !== undefined ? overrides.is_auto_generated : false,
    auto_type: overrides.auto_type || null,
    sport_tag: overrides.sport_tag || null,
    team_tag: overrides.team_tag || null,
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert(postData)
    .select()
    .single();

  if (error) throw new Error('createTestPost failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestPost: no data returned');
  return data;
}

async function createTestTeamPost(teamId, authorId, overrides = {}) {
  const postData = {
    team_id: teamId,
    author_id: authorId,
    content: overrides.content || `Team post ${randomString(8)}`,
    images: overrides.images || [],
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('team_posts')
    .insert(postData)
    .select()
    .single();

  if (error) throw new Error('createTestTeamPost failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTeamPost: no data returned');
  return data;
}

async function createTestTeamPhoto(teamId, userId, overrides = {}) {
  const photoData = {
    team_id: teamId,
    user_id: userId,
    image_url: overrides.image_url || 'https://example.com/photo.jpg',
    caption: overrides.caption || 'Test photo',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('team_photos')
    .insert(photoData)
    .select()
    .single();

  if (error) throw new Error('createTestTeamPhoto failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTeamPhoto: no data returned');
  return data;
}

async function createTestCMAssignment(teamId, userId, assignedBy, overrides = {}) {
  const cmData = {
    team_id: teamId,
    user_id: userId,
    assigned_by: assignedBy,
    status: overrides.status || 'active',
    permissions: overrides.permissions || {
      can_post: true,
      can_delete_posts: false,
      can_manage_photos: true,
      can_pin_posts: false
    },
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('team_cm_assignments')
    .insert(cmData)
    .select()
    .single();

  if (error) throw new Error('createTestCMAssignment failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestCMAssignment: no data returned');
  return data;
}

async function createTestNotification(userId, overrides = {}) {
  const notifData = {
    user_id: userId,
    type: overrides.type || 'system',
    title: overrides.title || 'Test notification',
    message: overrides.message || 'This is a test notification',
    data: overrides.data || {},
    is_read: overrides.is_read !== undefined ? overrides.is_read : false,
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert(notifData)
    .select()
    .single();

  if (error) throw new Error('createTestNotification failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestNotification: no data returned');
  return data;
}

async function createTestChatRequest(requesterId, recipientId, overrides = {}) {
  const requestData = {
    requester_id: requesterId,
    recipient_id: recipientId,
    status: overrides.status || 'pending',
    message: overrides.message || 'Salut, on peut discuter ?',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('chat_requests')
    .insert(requestData)
    .select()
    .single();

  if (error) throw new Error('createTestChatRequest failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestChatRequest: no data returned');
  return data;
}

async function createTestChatMessage(roomId, senderId, overrides = {}) {
  const msgData = {
    room_id: roomId,
    sender_id: senderId,
    content: overrides.content || `Message ${randomString(6)}`,
    type: overrides.type || 'text',
    mentions: overrides.mentions || [],
    read_by: overrides.read_by || [],
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert(msgData)
    .select()
    .single();

  if (error) throw new Error('createTestChatMessage failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestChatMessage: no data returned');
  return data;
}

async function createTestTournamentPayment(tournamentId, teamId, overrides = {}) {
  const paymentData = {
    tournament_id: tournamentId,
    team_id: teamId,
    amount: overrides.amount || 5000,
    method: overrides.method || 'wave',
    receiver: overrides.receiver || '+2250700000000',
    status: overrides.status || 'pending',
    organizer_amount: overrides.organizer_amount || 4500,
    platform_fee: overrides.platform_fee || 500,
    payout_status: overrides.payout_status || 'pending',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('tournament_payments')
    .insert(paymentData)
    .select()
    .single();

  if (error) throw new Error('createTestTournamentPayment failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTournamentPayment: no data returned');
  return data;
}

async function createTestTournamentTeam(tournamentId, teamId, overrides = {}) {
  const ttData = {
    tournament_id: tournamentId,
    team_id: teamId,
    status: overrides.status || 'pending_payment',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('tournament_teams')
    .insert(ttData)
    .select()
    .single();

  if (error) throw new Error('createTestTournamentTeam failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestTournamentTeam: no data returned');
  return data;
}

async function createTestInvoice(overrides = {}) {
  const invData = {
    invoice_number: overrides.invoice_number || `INV-${Date.now()}-${randomString(6).toUpperCase()}`,
    document_type: overrides.document_type || 'invoice',
    context_type: overrides.context_type || 'booking',
    context_id: overrides.context_id || crypto.randomUUID(),
    amount: overrides.amount || 10000,
    currency: overrides.currency || 'XOF',
    description: overrides.description || 'Test invoice',
    status: overrides.status || 'paid',
    payment_method: overrides.payment_method || 'in_app',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert(invData)
    .select()
    .single();

  if (error) throw new Error('createTestInvoice failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestInvoice: no data returned');
  return data;
}

async function createTestDissolutionRequest(teamId, requesterId, overrides = {}) {
  const dissData = {
    team_id: teamId,
    requester_id: requesterId,
    reason: overrides.reason || 'Team inactive',
    status: overrides.status || 'pending',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('team_dissolution_requests')
    .insert(dissData)
    .select()
    .single();

  if (error) throw new Error('createTestDissolutionRequest failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestDissolutionRequest: no data returned');
  return data;
}

async function createTestPayoutRequest(tournamentId, organizerId, overrides = {}) {
  const payoutData = {
    tournament_id: tournamentId,
    organizer_id: organizerId,
    requested_amount: overrides.requested_amount || 50000,
    purpose_category: overrides.purpose_category || 'venue',
    reason: overrides.reason || 'Paiement terrain',
    use_of_funds: overrides.use_of_funds || 'Location terrain pour le tournoi',
    budget_breakdown: overrides.budget_breakdown || 'Terrain: 50000 FCFA',
    amount_already_spent: overrides.amount_already_spent || 0,
    urgency: overrides.urgency || 'medium',
    payout_phone: overrides.payout_phone || '+2250700000000',
    status: overrides.status || 'pending',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('tournament_payout_requests')
    .insert(payoutData)
    .select()
    .single();

  if (error) throw new Error('createTestPayoutRequest failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestPayoutRequest: no data returned');
  return data;
}

async function createTestDispute(tournamentId, reportedBy, overrides = {}) {
  const disputeData = {
    tournament_id: tournamentId,
    reported_by: reportedBy,
    severity: overrides.severity || 'minor',
    reason: overrides.reason || 'Litige test',
    status: overrides.status || 'open',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('tournament_disputes')
    .insert(disputeData)
    .select()
    .single();

  if (error) throw new Error('createTestDispute failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestDispute: no data returned');
  return data;
}

async function createTestPostReport(postId, reporterId, overrides = {}) {
  const reportData = {
    post_id: postId,
    reporter_id: reporterId,
    reason: overrides.reason || 'Contenu inapproprié',
    status: overrides.status || 'pending',
    ...overrides
  };

  const { data, error } = await supabaseAdmin
    .from('post_reports')
    .insert(reportData)
    .select()
    .single();

  if (error) throw new Error('createTestPostReport failed: ' + error.message);
  if (!data || !data.id) throw new Error('createTestPostReport: no data returned');
  return data;
}

async function createTestFollow(followerId, followingId) {
  const { data, error } = await supabaseAdmin
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId })
    .select()
    .single();

  if (error) throw new Error('createTestFollow failed: ' + error.message);
  return data;
}

async function cleanup(ids) {
  // Delete child tables first (foreign key dependencies)

  // match_events & live_match_stats by match_id
  if (ids.matches && ids.matches.length > 0) {
    await supabaseAdmin.from('live_match_stats').delete().in('match_id', ids.matches);
    await supabaseAdmin.from('match_events').delete().in('match_id', ids.matches);
  }

  // tickets by event_id (if matches or tournaments are being cleaned)
  if (ids.tickets && ids.tickets.length > 0) {
    await supabaseAdmin.from('tickets').delete().in('id', ids.tickets);
  }

  // ticket_types
  if (ids.ticket_types && ids.ticket_types.length > 0) {
    await supabaseAdmin.from('ticket_types').delete().in('id', ids.ticket_types);
  }

  // post_reports
  if (ids.post_reports && ids.post_reports.length > 0) {
    await supabaseAdmin.from('post_reports').delete().in('id', ids.post_reports);
  }

  // post_likes & post_comments by post_id
  if (ids.posts && ids.posts.length > 0) {
    await supabaseAdmin.from('post_likes').delete().in('post_id', ids.posts);
    await supabaseAdmin.from('post_comments').delete().in('post_id', ids.posts);
    await supabaseAdmin.from('posts').delete().in('id', ids.posts);
  }

  // team_post_likes & team_post_comments by post_id
  if (ids.team_posts && ids.team_posts.length > 0) {
    await supabaseAdmin.from('team_post_likes').delete().in('post_id', ids.team_posts);
    await supabaseAdmin.from('team_post_comments').delete().in('post_id', ids.team_posts);
    await supabaseAdmin.from('team_posts').delete().in('id', ids.team_posts);
  }

  // team_photos
  if (ids.team_photos && ids.team_photos.length > 0) {
    await supabaseAdmin.from('team_photos').delete().in('id', ids.team_photos);
  }

  // team_cm_assignments
  if (ids.team_cm_assignments && ids.team_cm_assignments.length > 0) {
    await supabaseAdmin.from('team_cm_assignments').delete().in('id', ids.team_cm_assignments);
  }

  // team_dissolution_requests
  if (ids.team_dissolution_requests && ids.team_dissolution_requests.length > 0) {
    await supabaseAdmin.from('team_dissolution_requests').delete().in('id', ids.team_dissolution_requests);
  }

  // bookings
  if (ids.bookings && ids.bookings.length > 0) {
    await supabaseAdmin.from('bookings').delete().in('id', ids.bookings);
  }

  // invoices
  if (ids.invoices && ids.invoices.length > 0) {
    await supabaseAdmin.from('invoices').delete().in('id', ids.invoices);
  }

  // tournament_disputes
  if (ids.tournament_disputes && ids.tournament_disputes.length > 0) {
    await supabaseAdmin.from('tournament_disputes').delete().in('id', ids.tournament_disputes);
  }

  // tournament_payout_requests
  if (ids.tournament_payout_requests && ids.tournament_payout_requests.length > 0) {
    await supabaseAdmin.from('tournament_payout_requests').delete().in('id', ids.tournament_payout_requests);
  }

  // tournament_funds_ledger
  if (ids.tournament_funds_ledger && ids.tournament_funds_ledger.length > 0) {
    await supabaseAdmin.from('tournament_funds_ledger').delete().in('id', ids.tournament_funds_ledger);
  }

  // tournament_cancellation_requests
  if (ids.tournament_cancellation_requests && ids.tournament_cancellation_requests.length > 0) {
    await supabaseAdmin.from('tournament_cancellation_requests').delete().in('id', ids.tournament_cancellation_requests);
  }

  // tournament_payments
  if (ids.tournament_payments && ids.tournament_payments.length > 0) {
    await supabaseAdmin.from('tournament_payments').delete().in('id', ids.tournament_payments);
  }

  // tournament_teams
  if (ids.tournament_teams && ids.tournament_teams.length > 0) {
    await supabaseAdmin.from('tournament_teams').delete().in('id', ids.tournament_teams);
  }

  // follows
  if (ids.follows && ids.follows.length > 0) {
    await supabaseAdmin.from('follows').delete().in('id', ids.follows);
  }

  // chat_requests
  if (ids.chat_requests && ids.chat_requests.length > 0) {
    await supabaseAdmin.from('chat_requests').delete().in('id', ids.chat_requests);
  }

  // Standard tables
  const tables = [
    { name: 'match_events', key: 'match_events' },
    { name: 'live_match_stats', key: 'live_match_stats' },
    { name: 'chat_messages', key: 'chat_messages' },
    { name: 'chat_rooms', key: 'chat_rooms' },
    { name: 'notifications', key: 'notifications' },
    { name: 'trophies', key: 'trophies' },
    { name: 'user_trophies', key: 'user_trophies' },
    { name: 'player_rankings', key: 'player_rankings', pk: 'user_id' },
    { name: 'team_rankings', key: 'team_rankings', pk: 'team_id' },
    { name: 'matches', key: 'matches' },
    { name: 'tournaments', key: 'tournaments' },
    { name: 'teams', key: 'teams' },
    { name: 'venues', key: 'venues' },
    { name: 'users', key: 'users' }
  ];

  for (const table of tables) {
    const idsToDelete = ids[table.key];
    if (idsToDelete && idsToDelete.length > 0) {
      const pk = table.pk || 'id';
      await supabaseAdmin
        .from(table.name)
        .delete()
        .in(pk, idsToDelete);
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
  createTestChatRoom,
  createTestBooking,
  createTestTicketType,
  createTestTicket,
  createTestPost,
  createTestTeamPost,
  createTestTeamPhoto,
  createTestCMAssignment,
  createTestNotification,
  createTestChatRequest,
  createTestChatMessage,
  createTestTournamentPayment,
  createTestTournamentTeam,
  createTestInvoice,
  createTestDissolutionRequest,
  createTestPayoutRequest,
  createTestDispute,
  createTestPostReport,
  createTestFollow,
  cleanup,
  fakePhone
};
