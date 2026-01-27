-- =============================================
-- VERSUS SPORTS APP - SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar TEXT,
  phone TEXT UNIQUE,
  password_hash TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  bio TEXT,
  sports JSONB DEFAULT '[]'::jsonb,
  stats JSONB DEFAULT '{"matchesPlayed":0,"wins":0,"losses":0,"draws":0,"goalsScored":0,"assists":0,"mvpAwards":0,"fairPlayScore":5.0,"tournamentWins":0,"totalCashPrize":0}'::jsonb,
  reputation REAL DEFAULT 5.0,
  wallet_balance REAL DEFAULT 0,
  teams JSONB DEFAULT '[]'::jsonb,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  role TEXT DEFAULT 'user',
  location_lat REAL,
  location_lng REAL,
  location_city TEXT,
  location_country TEXT,
  availability JSONB DEFAULT '[]'::jsonb,
  referral_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEAMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo TEXT,
  sport TEXT NOT NULL,
  format TEXT NOT NULL,
  level TEXT NOT NULL,
  ambiance TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  description TEXT,
  captain_id UUID REFERENCES users(id) ON DELETE SET NULL,
  co_captain_ids JSONB DEFAULT '[]'::jsonb,
  members JSONB DEFAULT '[]'::jsonb,
  fans JSONB DEFAULT '[]'::jsonb,
  max_members INTEGER DEFAULT 15,
  stats JSONB DEFAULT '{"matchesPlayed":0,"wins":0,"losses":0,"draws":0,"goalsFor":0,"goalsAgainst":0,"tournamentWins":0,"totalCashPrize":0}'::jsonb,
  reputation REAL DEFAULT 5.0,
  is_recruiting BOOLEAN DEFAULT TRUE,
  join_requests JSONB DEFAULT '[]'::jsonb,
  custom_roles JSONB DEFAULT '[]'::jsonb,
  location_lat REAL,
  location_lng REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- VENUES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  sport JSONB DEFAULT '[]'::jsonb,
  price_per_hour REAL DEFAULT 0,
  images JSONB DEFAULT '[]'::jsonb,
  rating REAL DEFAULT 4.0,
  amenities JSONB DEFAULT '[]'::jsonb,
  latitude REAL,
  longitude REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MATCHES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport TEXT NOT NULL,
  format TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  venue_data JSONB,
  date_time TIMESTAMPTZ NOT NULL,
  duration INTEGER DEFAULT 90,
  level TEXT NOT NULL,
  ambiance TEXT NOT NULL,
  max_players INTEGER DEFAULT 22,
  registered_players JSONB DEFAULT '[]'::jsonb,
  score_home INTEGER,
  score_away INTEGER,
  mvp_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  entry_fee REAL DEFAULT 0,
  prize REAL DEFAULT 0,
  needs_players BOOLEAN DEFAULT FALSE,
  location_lat REAL,
  location_lng REAL,
  player_stats JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TOURNAMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sport TEXT NOT NULL,
  format TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'registration',
  level TEXT NOT NULL,
  max_teams INTEGER DEFAULT 16,
  registered_teams JSONB DEFAULT '[]'::jsonb,
  entry_fee REAL DEFAULT 0,
  prize_pool REAL DEFAULT 0,
  prizes JSONB DEFAULT '[]'::jsonb,
  venue_data JSONB,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  match_ids JSONB DEFAULT '[]'::jsonb,
  winner_id UUID,
  sponsor_name TEXT,
  sponsor_logo TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CHAT ROOMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  participants JSONB DEFAULT '[]'::jsonb,
  last_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CHAT REQUESTS TABLE (for direct messages)
-- =============================================
CREATE TABLE IF NOT EXISTS chat_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(requester_id, recipient_id)
);

-- =============================================
-- CHAT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  mentions JSONB DEFAULT '[]'::jsonb,
  read_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BOOKINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  total_price REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- REFERRALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FOLLOWS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- =============================================
-- TROPHIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS trophies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PUSH TOKENS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =============================================
-- SUPPORT TICKETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- USERS POLICIES (public access since we don't use Supabase Auth)
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can be updated" ON users FOR UPDATE USING (true);
CREATE POLICY "Users can be inserted" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can be deleted" ON users FOR DELETE USING (true);

-- TEAMS POLICIES (public access - auth handled at app level)
CREATE POLICY "Teams are viewable by everyone" ON teams FOR SELECT USING (true);
CREATE POLICY "Teams can be created" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Teams can be updated" ON teams FOR UPDATE USING (true);
CREATE POLICY "Teams can be deleted" ON teams FOR DELETE USING (true);

-- VENUES POLICIES (public access)
CREATE POLICY "Venues are viewable by everyone" ON venues FOR SELECT USING (true);
CREATE POLICY "Venues can be created" ON venues FOR INSERT WITH CHECK (true);
CREATE POLICY "Venues can be updated" ON venues FOR UPDATE USING (true);
CREATE POLICY "Venues can be deleted" ON venues FOR DELETE USING (true);

-- MATCHES POLICIES (public access - auth handled at app level)
CREATE POLICY "Matches are viewable by everyone" ON matches FOR SELECT USING (true);
CREATE POLICY "Matches can be created" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Matches can be updated" ON matches FOR UPDATE USING (true);
CREATE POLICY "Matches can be deleted" ON matches FOR DELETE USING (true);

-- TOURNAMENTS POLICIES (public access - auth handled at app level)
CREATE POLICY "Tournaments are viewable by everyone" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Tournaments can be created" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Tournaments can be updated" ON tournaments FOR UPDATE USING (true);
CREATE POLICY "Tournaments can be deleted" ON tournaments FOR DELETE USING (true);

-- CHAT ROOMS POLICIES (public access - auth handled at app level)
CREATE POLICY "Chat rooms are viewable by everyone" ON chat_rooms FOR SELECT USING (true);
CREATE POLICY "Chat rooms can be created" ON chat_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Chat rooms can be updated" ON chat_rooms FOR UPDATE USING (true);
CREATE POLICY "Chat rooms can be deleted" ON chat_rooms FOR DELETE USING (true);

-- CHAT MESSAGES POLICIES (public access - auth handled at app level)
CREATE POLICY "Chat messages are viewable by everyone" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat messages can be created" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Chat messages can be updated" ON chat_messages FOR UPDATE USING (true);
CREATE POLICY "Chat messages can be deleted" ON chat_messages FOR DELETE USING (true);

-- CHAT REQUESTS POLICIES
CREATE POLICY "Chat requests are viewable by participants" ON chat_requests FOR SELECT USING (true);
CREATE POLICY "Chat requests can be created" ON chat_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Chat requests can be updated" ON chat_requests FOR UPDATE USING (true);
CREATE POLICY "Chat requests can be deleted" ON chat_requests FOR DELETE USING (true);

-- NOTIFICATIONS POLICIES (public access - auth handled at app level)
CREATE POLICY "Notifications are viewable by everyone" ON notifications FOR SELECT USING (true);
CREATE POLICY "Notifications can be created" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications can be updated" ON notifications FOR UPDATE USING (true);
CREATE POLICY "Notifications can be deleted" ON notifications FOR DELETE USING (true);

-- BOOKINGS POLICIES (public access - auth handled at app level)
CREATE POLICY "Bookings are viewable by everyone" ON bookings FOR SELECT USING (true);
CREATE POLICY "Bookings can be created" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Bookings can be updated" ON bookings FOR UPDATE USING (true);
CREATE POLICY "Bookings can be deleted" ON bookings FOR DELETE USING (true);

-- REFERRALS POLICIES (public access - auth handled at app level)
CREATE POLICY "Referrals are viewable by everyone" ON referrals FOR SELECT USING (true);
CREATE POLICY "Referrals can be created" ON referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Referrals can be updated" ON referrals FOR UPDATE USING (true);
CREATE POLICY "Referrals can be deleted" ON referrals FOR DELETE USING (true);

-- FOLLOWS POLICIES (public access - auth handled at app level)
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Follows can be created" ON follows FOR INSERT WITH CHECK (true);
CREATE POLICY "Follows can be updated" ON follows FOR UPDATE USING (true);
CREATE POLICY "Follows can be deleted" ON follows FOR DELETE USING (true);

-- TROPHIES POLICIES
CREATE POLICY "Trophies are viewable by everyone" ON trophies FOR SELECT USING (true);
CREATE POLICY "System can insert trophies" ON trophies FOR INSERT WITH CHECK (true);

-- PUSH TOKENS POLICIES (public access - auth handled at app level)
CREATE POLICY "Push tokens are viewable by everyone" ON push_tokens FOR SELECT USING (true);
CREATE POLICY "Push tokens can be created" ON push_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Push tokens can be updated" ON push_tokens FOR UPDATE USING (true);
CREATE POLICY "Push tokens can be deleted" ON push_tokens FOR DELETE USING (true);

-- SUPPORT TICKETS POLICIES (public access - auth handled at app level)
CREATE POLICY "Support tickets are viewable by everyone" ON support_tickets FOR SELECT USING (true);
CREATE POLICY "Support tickets can be created" ON support_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Support tickets can be updated" ON support_tickets FOR UPDATE USING (true);
CREATE POLICY "Support tickets can be deleted" ON support_tickets FOR DELETE USING (true);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_teams_captain ON teams(captain_id);
CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport);
CREATE INDEX IF NOT EXISTS idx_teams_city ON teams(city);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_sport ON matches(sport);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date_time);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- =============================================
-- SEED DATA - DEFAULT VENUES
-- =============================================
INSERT INTO venues (id, name, address, city, sport, price_per_hour, rating, amenities, latitude, longitude)
VALUES 
  (uuid_generate_v4(), 'Stade Félix Houphouët-Boigny', 'Plateau', 'Abidjan', '["football","athletics"]'::jsonb, 50000, 4.5, '["Vestiaires","Parking","Éclairage"]'::jsonb, 5.3167, -4.0167),
  (uuid_generate_v4(), 'Palais des Sports de Treichville', 'Treichville', 'Abidjan', '["basketball","volleyball","handball"]'::jsonb, 30000, 4.3, '["Vestiaires","Climatisation","Gradins"]'::jsonb, 5.3000, -3.9833),
  (uuid_generate_v4(), 'Terrain Synthétique Riviera', 'Riviera Golf', 'Abidjan', '["football","futsal"]'::jsonb, 25000, 4.7, '["Vestiaires","Parking","Éclairage","Cafétéria"]'::jsonb, 5.3667, -3.9500)
ON CONFLICT DO NOTHING;

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================
-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
