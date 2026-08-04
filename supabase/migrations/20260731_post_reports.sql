-- Post reports table
CREATE TABLE IF NOT EXISTS post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, reporter_id)
);

-- RLS policies
ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;

-- Users can report posts (insert their own reports)
CREATE POLICY "Users can create reports" ON post_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Users can see their own reports
CREATE POLICY "Users can view own reports" ON post_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports" ON post_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update report status
CREATE POLICY "Admins can update reports" ON post_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON post_reports(status);
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON post_reports(post_id);
