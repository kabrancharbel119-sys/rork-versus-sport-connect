-- Team photos gallery table
CREATE TABLE IF NOT EXISTS team_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching photos by team ordered by date
CREATE INDEX IF NOT EXISTS idx_team_photos_team_id ON team_photos(team_id, created_at DESC);

-- RLS policies
ALTER TABLE team_photos ENABLE ROW LEVEL SECURITY;

-- Everyone can view team photos (public gallery)
CREATE POLICY "Anyone can view team photos" ON team_photos
  FOR SELECT USING (true);

-- Only team members can insert photos
-- Check that the user is a member of the team
CREATE POLICY "Team members can add photos" ON team_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_photos.team_id
      AND (
        teams.captain_id::text = auth.uid()::text
        OR teams.co_captain_ids::text LIKE '%' || auth.uid()::text || '%'
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(teams.members) AS member
          WHERE member->>'userId' = auth.uid()::text
        )
      )
    )
  );

-- Only the photo uploader or team captain can delete photos
CREATE POLICY "Photo owner or captain can delete" ON team_photos
  FOR DELETE USING (
    user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_photos.team_id
      AND teams.captain_id::text = auth.uid()::text
    )
  );
