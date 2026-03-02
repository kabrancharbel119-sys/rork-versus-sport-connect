-- ============================================
-- LIVE SCORING & RANKING SYSTEM
-- Tables pour le système de scoring en direct et classement global
-- ============================================

-- Table des événements de match en direct
CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('goal', 'yellow_card', 'red_card', 'substitution', 'penalty', 'own_goal', 'assist', 'save', 'injury', 'timeout', 'period_start', 'period_end', 'match_start', 'match_end')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  minute INTEGER NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second', 'penalties')),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_name TEXT,
  assist_player_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assist_player_name TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_type ON match_events(type);
CREATE INDEX IF NOT EXISTS idx_match_events_timestamp ON match_events(timestamp DESC);

-- Table des statistiques live de match
CREATE TABLE IF NOT EXISTS live_match_stats (
  match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  current_period TEXT NOT NULL DEFAULT 'first_half',
  current_minute INTEGER NOT NULL DEFAULT 0,
  is_live BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{"home": {}, "away": {}}',
  events JSONB DEFAULT '[]',
  last_update TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_live_match_stats_is_live ON live_match_stats(is_live) WHERE is_live = true;

-- Table des classements joueurs
CREATE TABLE IF NOT EXISTS player_rankings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  elo_rating INTEGER NOT NULL DEFAULT 1200,
  previous_elo_rating INTEGER NOT NULL DEFAULT 1200,
  elo_change INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  previous_rank INTEGER NOT NULL DEFAULT 0,
  rank_change INTEGER NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{
    "totalMatches": 0,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "winRate": 0,
    "totalGoals": 0,
    "totalAssists": 0,
    "averageRating": 0,
    "currentWinStreak": 0,
    "longestWinStreak": 0,
    "currentLossStreak": 0,
    "rankedMatches": 0,
    "rankedWins": 0,
    "rankedLosses": 0,
    "recentForm": [],
    "recentPerformance": 50
  }',
  sport_rankings JSONB NOT NULL DEFAULT '{}',
  achievements JSONB NOT NULL DEFAULT '[]',
  badges JSONB NOT NULL DEFAULT '[]',
  last_match_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_player_rankings_elo ON player_rankings(elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_player_rankings_rank ON player_rankings(rank ASC);
CREATE INDEX IF NOT EXISTS idx_player_rankings_updated ON player_rankings(updated_at DESC);

-- Table des classements équipes
CREATE TABLE IF NOT EXISTS team_rankings (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  elo_rating INTEGER NOT NULL DEFAULT 1200,
  previous_elo_rating INTEGER NOT NULL DEFAULT 1200,
  elo_change INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  previous_rank INTEGER NOT NULL DEFAULT 0,
  rank_change INTEGER NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{
    "totalMatches": 0,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "winRate": 0,
    "goalsFor": 0,
    "goalsAgainst": 0,
    "goalDifference": 0,
    "cleanSheets": 0,
    "currentWinStreak": 0,
    "longestWinStreak": 0,
    "recentForm": []
  }',
  last_match_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_team_rankings_sport ON team_rankings(sport);
CREATE INDEX IF NOT EXISTS idx_team_rankings_elo ON team_rankings(elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_team_rankings_rank ON team_rankings(rank ASC);

-- Table de l'historique de classement
CREATE TABLE IF NOT EXISTS ranking_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  elo_rating INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  matches_played INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_ranking_history_user_date ON ranking_history(user_id, date DESC);

-- Table des mises à jour de classement
CREATE TABLE IF NOT EXISTS ranking_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  old_elo INTEGER NOT NULL,
  new_elo INTEGER NOT NULL,
  elo_change INTEGER NOT NULL,
  old_rank INTEGER NOT NULL,
  new_rank INTEGER NOT NULL,
  rank_change INTEGER NOT NULL,
  achievements_unlocked JSONB DEFAULT '[]',
  badges_earned JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_ranking_updates_user ON ranking_updates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_updates_match ON ranking_updates(match_id);

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour mettre à jour automatiquement le timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour mise à jour automatique
CREATE TRIGGER update_player_rankings_updated_at
  BEFORE UPDATE ON player_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_rankings_updated_at
  BEFORE UPDATE ON team_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_match_stats_updated_at
  BEFORE UPDATE ON live_match_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLITIQUES RLS (Row Level Security)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_updates ENABLE ROW LEVEL SECURITY;

-- Politiques pour match_events
CREATE POLICY "Match events are viewable by everyone"
  ON match_events FOR SELECT
  USING (true);

CREATE POLICY "Match events can be created by authenticated users"
  ON match_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Match events can be deleted by creator or match creator"
  ON match_events FOR DELETE
  USING (
    auth.uid() = created_by OR
    auth.uid() IN (
      SELECT created_by FROM matches WHERE id = match_id
    )
  );

-- Politiques pour live_match_stats
CREATE POLICY "Live match stats are viewable by everyone"
  ON live_match_stats FOR SELECT
  USING (true);

CREATE POLICY "Live match stats can be updated by match creator"
  ON live_match_stats FOR ALL
  USING (
    auth.uid() IN (
      SELECT created_by FROM matches WHERE id = match_id
    )
  );

-- Politiques pour player_rankings
CREATE POLICY "Player rankings are viewable by everyone"
  ON player_rankings FOR SELECT
  USING (true);

CREATE POLICY "Player rankings can be updated by system"
  ON player_rankings FOR ALL
  USING (true);

-- Politiques pour team_rankings
CREATE POLICY "Team rankings are viewable by everyone"
  ON team_rankings FOR SELECT
  USING (true);

CREATE POLICY "Team rankings can be updated by system"
  ON team_rankings FOR ALL
  USING (true);

-- Politiques pour ranking_history
CREATE POLICY "Ranking history is viewable by owner"
  ON ranking_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Ranking history can be inserted by system"
  ON ranking_history FOR INSERT
  WITH CHECK (true);

-- Politiques pour ranking_updates
CREATE POLICY "Ranking updates are viewable by owner"
  ON ranking_updates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Ranking updates can be inserted by system"
  ON ranking_updates FOR INSERT
  WITH CHECK (true);

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue pour le top 100 global
CREATE OR REPLACE VIEW top_100_global AS
SELECT 
  pr.*,
  u.username,
  u.full_name,
  u.avatar,
  u.city
FROM player_rankings pr
JOIN users u ON u.id = pr.user_id
ORDER BY pr.elo_rating DESC
LIMIT 100;

-- Vue pour les matchs en direct
CREATE OR REPLACE VIEW live_matches AS
SELECT 
  m.*,
  lms.home_score,
  lms.away_score,
  lms.current_period,
  lms.current_minute,
  lms.started_at,
  ht.name as home_team_name,
  ht.logo as home_team_logo,
  at.name as away_team_name,
  at.logo as away_team_logo
FROM matches m
JOIN live_match_stats lms ON lms.match_id = m.id
JOIN teams ht ON ht.id = lms.home_team_id
JOIN teams at ON at.id = lms.away_team_id
WHERE lms.is_live = true
ORDER BY lms.started_at DESC;

-- ============================================
-- DONNÉES INITIALES
-- ============================================

-- Créer les classements initiaux pour tous les utilisateurs existants
INSERT INTO player_rankings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE match_events IS 'Événements de match en temps réel (buts, cartons, etc.)';
COMMENT ON TABLE live_match_stats IS 'Statistiques en direct des matchs';
COMMENT ON TABLE player_rankings IS 'Classement ELO des joueurs';
COMMENT ON TABLE team_rankings IS 'Classement ELO des équipes';
COMMENT ON TABLE ranking_history IS 'Historique des classements joueurs';
COMMENT ON TABLE ranking_updates IS 'Mises à jour de classement après chaque match';
