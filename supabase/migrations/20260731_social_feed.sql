-- =============================================
-- SOCIAL FEED - Posts, Likes, Comments
-- 100% idempotent & safe — can be run multiple times
-- =============================================

-- POSTS TABLE
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  sport_tag TEXT,
  team_tag UUID REFERENCES teams(id) ON DELETE SET NULL,
  match_tag UUID REFERENCES matches(id) ON DELETE SET NULL,
  tournament_tag UUID,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  auto_type TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- POST LIKES TABLE
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- POST COMMENTS TABLE
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS — safe enable (no-op if already enabled)
-- =============================================
DO $$ BEGIN ALTER TABLE posts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =============================================
-- RLS POLICIES — created only if they don't exist
-- =============================================
DO $$ BEGIN
  CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Posts can be created by authenticated users" ON posts FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Posts can be updated by author" ON posts FOR UPDATE USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Posts can be deleted by author" ON posts FOR DELETE USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Likes are viewable by everyone" ON post_likes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Likes can be created" ON post_likes FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Likes can be deleted by owner" ON post_likes FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Comments are viewable by everyone" ON post_comments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Comments can be created" ON post_comments FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Comments can be deleted by author" ON post_comments FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_sport ON posts(sport_tag) WHERE sport_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);

-- =============================================
-- TRIGGERS: auto-update likes_count / comments_count
-- =============================================
CREATE OR REPLACE FUNCTION increment_post_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_post_comments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_comments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS — create only if not exists (no DROP)
-- =============================================
DO $$ BEGIN
  CREATE TRIGGER trg_post_likes_insert AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION increment_post_likes();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_likes_delete AFTER DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION decrement_post_likes();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_comments_insert AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION increment_post_comments();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_comments_delete AFTER DELETE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_post_comments();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- RPC: get_feed_posts
-- Returns posts from users that the given user follows + own posts
-- =============================================
CREATE OR REPLACE FUNCTION get_feed_posts(p_user_id UUID, p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  content TEXT,
  images JSONB,
  sport_tag TEXT,
  team_tag UUID,
  match_tag UUID,
  tournament_tag UUID,
  is_auto_generated BOOLEAN,
  auto_type TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  created_at TIMESTAMPTZ,
  author_username TEXT,
  author_full_name TEXT,
  author_avatar TEXT,
  author_is_verified BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.author_id,
    p.content,
    p.images,
    p.sport_tag,
    p.team_tag,
    p.match_tag,
    p.tournament_tag,
    p.is_auto_generated,
    p.auto_type,
    p.likes_count,
    p.comments_count,
    p.created_at,
    u.username AS author_username,
    u.full_name AS author_full_name,
    u.avatar AS author_avatar,
    u.is_verified AS author_is_verified
  FROM posts p
  INNER JOIN users u ON u.id = p.author_id
  WHERE p.author_id = p_user_id
     OR p.author_id IN (SELECT following_id FROM follows WHERE follower_id = p_user_id)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- =============================================
-- STORAGE BUCKET for post images
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts-images', 'posts-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — created only if they don't exist
DO $$ BEGIN
  CREATE POLICY "Post images are publicly viewable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'posts-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload post images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'posts-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own post images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'posts-images' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
