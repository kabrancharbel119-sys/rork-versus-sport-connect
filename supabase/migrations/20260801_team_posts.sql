-- =============================================
-- TEAM POSTS — Feed personnalisé d'équipe
-- Posts by CM or Captain on behalf of the team
-- 100% idempotent & safe
-- =============================================

CREATE TABLE IF NOT EXISTS team_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS
-- =============================================
DO $$ BEGIN ALTER TABLE team_posts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Public read: anyone can see team posts (fans + public)
DO $$ BEGIN
  CREATE POLICY "Team posts are viewable by everyone"
  ON team_posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert: only captain, co-captains, or CM members of the team
DO $$ BEGIN
  CREATE POLICY "Team members can insert team posts"
  ON team_posts FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_posts.team_id
      AND (
        t.captain_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(t.co_captain_ids) cc
          WHERE cc.value = auth.uid()::text
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(t.members) m
          WHERE m->>'userId' = auth.uid()::text
          AND m->>'role' = 'cm'
        )
      )
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Delete: only captain or post author
DO $$ BEGIN
  CREATE POLICY "Captain or author can delete team posts"
  ON team_posts FOR DELETE USING (
    team_posts.author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_posts.team_id AND t.captain_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update: only author
DO $$ BEGIN
  CREATE POLICY "Author can update team posts"
  ON team_posts FOR UPDATE USING (team_posts.author_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_team_posts_team ON team_posts(team_id);
CREATE INDEX IF NOT EXISTS idx_team_posts_created ON team_posts(created_at DESC);

-- =============================================
-- TRIGGERS: likes/comments count (reusing pattern from posts)
-- =============================================
CREATE TABLE IF NOT EXISTS team_post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES team_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES team_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES team_post_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN ALTER TABLE team_post_likes ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE team_post_comments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team post likes viewable by everyone" ON team_post_likes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team post likes can be created" ON team_post_likes FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team post likes can be deleted by owner" ON team_post_likes FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team post comments viewable by everyone" ON team_post_comments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team post comments can be created" ON team_post_comments FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team post comments can be deleted by author" ON team_post_comments FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers for counts
CREATE OR REPLACE FUNCTION increment_team_post_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_team_post_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_team_post_comments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_team_post_comments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_team_post_likes_insert AFTER INSERT ON team_post_likes
  FOR EACH ROW EXECUTE FUNCTION increment_team_post_likes();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_team_post_likes_delete AFTER DELETE ON team_post_likes
  FOR EACH ROW EXECUTE FUNCTION decrement_team_post_likes();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_team_post_comments_insert AFTER INSERT ON team_post_comments
  FOR EACH ROW EXECUTE FUNCTION increment_team_post_comments();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_team_post_comments_delete AFTER DELETE ON team_post_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_team_post_comments();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_team_post_likes_post ON team_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_team_post_likes_user ON team_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_team_post_comments_post ON team_post_comments(post_id);
