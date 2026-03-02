-- ============================================
-- CORRECTION COMPLÈTE: Policies RLS pour tous les tests E2E
-- ============================================

-- ============================================
-- TABLE VENUES
-- ============================================
DROP POLICY IF EXISTS "Venues are viewable by everyone" ON venues;
DROP POLICY IF EXISTS "venues_select_all" ON venues;
DROP POLICY IF EXISTS "venues_insert_all" ON venues;
DROP POLICY IF EXISTS "venues_update_all" ON venues;
DROP POLICY IF EXISTS "venues_delete_admin" ON venues;

CREATE POLICY "venues_select_all"
  ON venues FOR SELECT
  USING (true);

CREATE POLICY "venues_insert_all"
  ON venues FOR INSERT
  WITH CHECK (true);

CREATE POLICY "venues_update_all"
  ON venues FOR UPDATE
  USING (true);

CREATE POLICY "venues_delete_admin"
  ON venues FOR DELETE
  USING (true);

-- ============================================
-- TABLE MATCHES
-- ============================================
DROP POLICY IF EXISTS "Matches are viewable by everyone" ON matches;
DROP POLICY IF EXISTS "matches_select_all" ON matches;
DROP POLICY IF EXISTS "matches_insert_all" ON matches;
DROP POLICY IF EXISTS "matches_update_all" ON matches;
DROP POLICY IF EXISTS "matches_delete_all" ON matches;

CREATE POLICY "matches_select_all"
  ON matches FOR SELECT
  USING (true);

CREATE POLICY "matches_insert_all"
  ON matches FOR INSERT
  WITH CHECK (true);

CREATE POLICY "matches_update_all"
  ON matches FOR UPDATE
  USING (true);

CREATE POLICY "matches_delete_all"
  ON matches FOR DELETE
  USING (true);

-- ============================================
-- TABLE TEAMS
-- ============================================
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON teams;
DROP POLICY IF EXISTS "teams_select_all" ON teams;
DROP POLICY IF EXISTS "teams_insert_all" ON teams;
DROP POLICY IF EXISTS "teams_update_all" ON teams;
DROP POLICY IF EXISTS "teams_delete_all" ON teams;

CREATE POLICY "teams_select_all"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "teams_insert_all"
  ON teams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "teams_update_all"
  ON teams FOR UPDATE
  USING (true);

CREATE POLICY "teams_delete_all"
  ON teams FOR DELETE
  USING (true);

-- ============================================
-- TABLE TOURNAMENTS
-- ============================================
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON tournaments;
DROP POLICY IF EXISTS "tournaments_select_all" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert_all" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update_all" ON tournaments;
DROP POLICY IF EXISTS "tournaments_delete_all" ON tournaments;

CREATE POLICY "tournaments_select_all"
  ON tournaments FOR SELECT
  USING (true);

CREATE POLICY "tournaments_insert_all"
  ON tournaments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "tournaments_update_all"
  ON tournaments FOR UPDATE
  USING (true);

CREATE POLICY "tournaments_delete_all"
  ON tournaments FOR DELETE
  USING (true);

-- ============================================
-- TABLE TROPHIES
-- ============================================
DROP POLICY IF EXISTS "Trophies are viewable by everyone" ON trophies;
DROP POLICY IF EXISTS "trophies_select_all" ON trophies;
DROP POLICY IF EXISTS "trophies_insert_all" ON trophies;
DROP POLICY IF EXISTS "trophies_update_all" ON trophies;
DROP POLICY IF EXISTS "trophies_delete_all" ON trophies;

CREATE POLICY "trophies_select_all"
  ON trophies FOR SELECT
  USING (true);

CREATE POLICY "trophies_insert_all"
  ON trophies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "trophies_update_all"
  ON trophies FOR UPDATE
  USING (true);

CREATE POLICY "trophies_delete_all"
  ON trophies FOR DELETE
  USING (true);

-- ============================================
-- TABLE CHAT_MESSAGES
-- ============================================
DROP POLICY IF EXISTS "Chat messages are viewable by participants" ON chat_messages;
DROP POLICY IF EXISTS "chat_select_all" ON chat_messages;
DROP POLICY IF EXISTS "chat_insert_all" ON chat_messages;
DROP POLICY IF EXISTS "chat_update_all" ON chat_messages;
DROP POLICY IF EXISTS "chat_delete_all" ON chat_messages;

CREATE POLICY "chat_select_all"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "chat_insert_all"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "chat_update_all"
  ON chat_messages FOR UPDATE
  USING (true);

CREATE POLICY "chat_delete_all"
  ON chat_messages FOR DELETE
  USING (true);

-- ============================================
-- TABLE MATCH_EVENTS
-- ============================================
DROP POLICY IF EXISTS "Anyone can view match events" ON match_events;
DROP POLICY IF EXISTS "match_events_select_all" ON match_events;
DROP POLICY IF EXISTS "match_events_insert_all" ON match_events;
DROP POLICY IF EXISTS "match_events_update_all" ON match_events;
DROP POLICY IF EXISTS "match_events_delete_all" ON match_events;

CREATE POLICY "match_events_select_all"
  ON match_events FOR SELECT
  USING (true);

CREATE POLICY "match_events_insert_all"
  ON match_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "match_events_update_all"
  ON match_events FOR UPDATE
  USING (true);

CREATE POLICY "match_events_delete_all"
  ON match_events FOR DELETE
  USING (true);

-- ============================================
-- TABLE LIVE_MATCH_STATS
-- ============================================
DROP POLICY IF EXISTS "Anyone can view live stats" ON live_match_stats;
DROP POLICY IF EXISTS "live_stats_select_all" ON live_match_stats;
DROP POLICY IF EXISTS "live_stats_insert_all" ON live_match_stats;
DROP POLICY IF EXISTS "live_stats_update_all" ON live_match_stats;
DROP POLICY IF EXISTS "live_stats_delete_all" ON live_match_stats;

CREATE POLICY "live_stats_select_all"
  ON live_match_stats FOR SELECT
  USING (true);

CREATE POLICY "live_stats_insert_all"
  ON live_match_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "live_stats_update_all"
  ON live_match_stats FOR UPDATE
  USING (true);

CREATE POLICY "live_stats_delete_all"
  ON live_match_stats FOR DELETE
  USING (true);

-- ============================================
-- TABLE PLAYER_RANKINGS
-- ============================================
DROP POLICY IF EXISTS "Anyone can view player rankings" ON player_rankings;
DROP POLICY IF EXISTS "player_rankings_select_all" ON player_rankings;
DROP POLICY IF EXISTS "player_rankings_insert_all" ON player_rankings;
DROP POLICY IF EXISTS "player_rankings_update_all" ON player_rankings;
DROP POLICY IF EXISTS "player_rankings_delete_all" ON player_rankings;

CREATE POLICY "player_rankings_select_all"
  ON player_rankings FOR SELECT
  USING (true);

CREATE POLICY "player_rankings_insert_all"
  ON player_rankings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "player_rankings_update_all"
  ON player_rankings FOR UPDATE
  USING (true);

CREATE POLICY "player_rankings_delete_all"
  ON player_rankings FOR DELETE
  USING (true);

-- ============================================
-- TABLE TEAM_RANKINGS
-- ============================================
DROP POLICY IF EXISTS "Anyone can view team rankings" ON team_rankings;
DROP POLICY IF EXISTS "team_rankings_select_all" ON team_rankings;
DROP POLICY IF EXISTS "team_rankings_insert_all" ON team_rankings;
DROP POLICY IF EXISTS "team_rankings_update_all" ON team_rankings;
DROP POLICY IF EXISTS "team_rankings_delete_all" ON team_rankings;

CREATE POLICY "team_rankings_select_all"
  ON team_rankings FOR SELECT
  USING (true);

CREATE POLICY "team_rankings_insert_all"
  ON team_rankings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "team_rankings_update_all"
  ON team_rankings FOR UPDATE
  USING (true);

CREATE POLICY "team_rankings_delete_all"
  ON team_rankings FOR DELETE
  USING (true);

-- ============================================
-- VÉRIFICATION
-- ============================================
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE 'Total policies RLS créées: %', policy_count;
END $$;
