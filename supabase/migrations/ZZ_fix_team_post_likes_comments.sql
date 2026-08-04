-- =============================================
-- FIX: Ensure team_post_likes and team_post_comments tables exist
-- and have correct RLS policies and triggers
-- 100% idempotent & safe
-- =============================================

-- 1. Ensure tables exist
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

-- 2. Enable RLS
DO $$ BEGIN ALTER TABLE team_post_likes ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE team_post_comments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. RLS Policies (drop & recreate to be safe)
DROP POLICY IF EXISTS "Team post likes viewable by everyone" ON team_post_likes;
DROP POLICY IF EXISTS "Team post likes can be created" ON team_post_likes;
DROP POLICY IF EXISTS "Team post likes can be deleted by owner" ON team_post_likes;

DROP POLICY IF EXISTS "Team post comments viewable by everyone" ON team_post_comments;
DROP POLICY IF EXISTS "Team post comments can be created" ON team_post_comments;
DROP POLICY IF EXISTS "Team post comments can be deleted by author" ON team_post_comments;

CREATE POLICY "Team post likes viewable by everyone" ON team_post_likes FOR SELECT USING (true);
CREATE POLICY "Team post likes can be created" ON team_post_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Team post likes can be deleted by owner" ON team_post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Team post comments viewable by everyone" ON team_post_comments FOR SELECT USING (true);
CREATE POLICY "Team post comments can be created" ON team_post_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Team post comments can be deleted by author" ON team_post_comments FOR DELETE USING (auth.uid() = user_id);

-- 4. Triggers for counts (drop & recreate)
DROP TRIGGER IF EXISTS trg_team_post_likes_insert ON team_post_likes;
DROP TRIGGER IF EXISTS trg_team_post_likes_delete ON team_post_likes;
DROP TRIGGER IF EXISTS trg_team_post_comments_insert ON team_post_comments;
DROP TRIGGER IF EXISTS trg_team_post_comments_delete ON team_post_comments;

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

CREATE TRIGGER trg_team_post_likes_insert AFTER INSERT ON team_post_likes
  FOR EACH ROW EXECUTE FUNCTION increment_team_post_likes();

CREATE TRIGGER trg_team_post_likes_delete AFTER DELETE ON team_post_likes
  FOR EACH ROW EXECUTE FUNCTION decrement_team_post_likes();

CREATE TRIGGER trg_team_post_comments_insert AFTER INSERT ON team_post_comments
  FOR EACH ROW EXECUTE FUNCTION increment_team_post_comments();

CREATE TRIGGER trg_team_post_comments_delete AFTER DELETE ON team_post_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_team_post_comments();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_team_post_likes_post ON team_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_team_post_likes_user ON team_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_team_post_comments_post ON team_post_comments(post_id);

-- 6. Sync counts from actual data (fix any drift)
UPDATE team_posts p
SET likes_count = (SELECT COUNT(*) FROM team_post_likes l WHERE l.post_id = p.id)
WHERE EXISTS (SELECT 1 FROM team_post_likes l WHERE l.post_id = p.id)
   OR p.likes_count > 0;

UPDATE team_posts p
SET comments_count = (SELECT COUNT(*) FROM team_post_comments c WHERE c.post_id = p.id)
WHERE EXISTS (SELECT 1 FROM team_post_comments c WHERE c.post_id = p.id)
   OR p.comments_count > 0;
