-- =============================================
-- USER TROPHIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_trophies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  trophy_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  unlocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- User can only have one entry per trophy
  UNIQUE(user_id, trophy_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_trophies_user_id ON user_trophies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trophies_trophy_id ON user_trophies(trophy_id);
CREATE INDEX IF NOT EXISTS idx_user_trophies_unlocked ON user_trophies(unlocked_at) WHERE unlocked_at IS NOT NULL;

-- Enable RLS
ALTER TABLE user_trophies ENABLE ROW LEVEL SECURITY;

-- Users can view their own trophies
CREATE POLICY "Users can view their own trophies" 
  ON user_trophies 
  FOR SELECT 
  USING (user_id = auth.uid());

-- Users can update their own trophy progress
CREATE POLICY "Users can update their own trophies" 
  ON user_trophies 
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can insert trophies
CREATE POLICY "System can insert trophies" 
  ON user_trophies 
  FOR INSERT 
  WITH CHECK (true);

-- Admin can view all trophies
CREATE POLICY "Admins can view all trophies" 
  ON user_trophies 
  FOR ALL 
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_trophy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Auto-set unlocked_at when progress reaches 100
  IF NEW.progress >= 100 AND OLD.progress < 100 THEN
    NEW.unlocked_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_trophy_timestamp ON user_trophies;
CREATE TRIGGER update_user_trophy_timestamp
  BEFORE UPDATE ON user_trophies
  FOR EACH ROW
  EXECUTE FUNCTION update_user_trophy_timestamp();

-- Trophy definitions (reference table)
CREATE TABLE IF NOT EXISTS trophy_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  category TEXT NOT NULL,
  requirement INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0
);

-- Insert default trophies
INSERT INTO trophy_definitions (id, name, description, icon, rarity, category, requirement, xp_reward) VALUES
  ('first-match', 'Premier Pas', 'Jouer votre premier match', '⚽', 'common', 'matches', 1, 50),
  ('matches-10', 'Régulier', 'Jouer 10 matchs', '🏃', 'common', 'matches', 10, 100),
  ('matches-50', 'Vétéran', 'Jouer 50 matchs', '🎖️', 'rare', 'matches', 50, 300),
  ('matches-100', 'Légende du Terrain', 'Jouer 100 matchs', '🏆', 'epic', 'matches', 100, 500),
  ('matches-500', 'Immortel', 'Jouer 500 matchs', '👑', 'legendary', 'matches', 500, 1500),
  ('first-win', 'Première Victoire', 'Gagner votre premier match', '✌️', 'common', 'wins', 1, 75),
  ('wins-10', 'Gagnant', 'Gagner 10 matchs', '🥇', 'common', 'wins', 10, 150),
  ('wins-25', 'Champion', 'Gagner 25 matchs', '🏅', 'rare', 'wins', 25, 350),
  ('wins-50', 'Dominateur', 'Gagner 50 matchs', '💪', 'epic', 'wins', 50, 600),
  ('wins-100', 'Invincible', 'Gagner 100 matchs', '🔥', 'legendary', 'wins', 100, 2000),
  ('first-goal', 'Premier But', 'Marquer votre premier but', '🥅', 'common', 'goals', 1, 50),
  ('goals-10', 'Buteur', 'Marquer 10 buts', '⚡', 'common', 'goals', 10, 120),
  ('goals-50', 'Machine à Buts', 'Marquer 50 buts', '💥', 'rare', 'goals', 50, 400),
  ('goals-100', 'Légende Offensive', 'Marquer 100 buts', '🎯', 'epic', 'goals', 100, 800),
  ('first-assist', 'Passeur Décisif', 'Faire votre première passe décisive', '🤝', 'common', 'assists', 1, 50),
  ('assists-25', 'Créateur', 'Faire 25 passes décisives', '🎨', 'rare', 'assists', 25, 350),
  ('assists-50', 'Maestro', 'Faire 50 passes décisives', '🎼', 'epic', 'assists', 50, 600),
  ('first-mvp', 'MVP', 'Être élu MVP d''un match', '⭐', 'rare', 'mvp', 1, 200),
  ('mvp-5', 'Star', 'Être MVP 5 fois', '🌟', 'epic', 'mvp', 5, 500),
  ('mvp-10', 'Superstar', 'Être MVP 10 fois', '💫', 'legendary', 'mvp', 10, 1000),
  ('first-tournament', 'Compétiteur', 'Participer à un tournoi', '🏟️', 'common', 'tournaments', 1, 100),
  ('tournament-win', 'Champion de Tournoi', 'Gagner un tournoi', '🏆', 'epic', 'tournaments', 1, 750),
  ('tournament-wins-3', 'Triple Champion', 'Gagner 3 tournois', '👑', 'legendary', 'tournaments', 3, 2000),
  ('followers-10', 'Influenceur', 'Avoir 10 followers', '📱', 'common', 'social', 10, 100),
  ('followers-50', 'Populaire', 'Avoir 50 followers', '🔔', 'rare', 'social', 50, 300),
  ('followers-100', 'Célébrité', 'Avoir 100 followers', '📢', 'epic', 'social', 100, 600),
  ('verified', 'Vérifié', 'Obtenir le badge vérifié', '✅', 'rare', 'special', 1, 250),
  ('premium', 'Premium', 'Devenir membre premium', '💎', 'epic', 'special', 1, 500),
  ('team-captain', 'Leader', 'Devenir capitaine d''une équipe', '🎖️', 'rare', 'special', 1, 300),
  ('fair-play', 'Fair Play', 'Avoir un score Fair Play de 4.5+', '🤗', 'rare', 'special', 1, 250),
  ('profile-complete', 'Profil Complet', 'Compléter votre profil à 100%', '📝', 'common', 'special', 1, 75),
  ('first-team', 'Esprit d''Équipe', 'Rejoindre votre première équipe', '👥', 'common', 'social', 1, 100)
ON CONFLICT (id) DO NOTHING;
