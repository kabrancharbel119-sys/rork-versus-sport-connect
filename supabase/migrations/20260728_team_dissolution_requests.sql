-- Add creator_id column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill creator_id with captain_id for existing teams
UPDATE teams SET creator_id = captain_id WHERE creator_id IS NULL AND captain_id IS NOT NULL;

-- Team dissolution requests table
CREATE TABLE IF NOT EXISTS team_dissolution_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_name TEXT,
  team_sport TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Index for quick lookup of pending requests
CREATE INDEX IF NOT EXISTS idx_team_dissolution_pending ON team_dissolution_requests (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_dissolution_team ON team_dissolution_requests (team_id);

-- RLS policies
ALTER TABLE team_dissolution_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "Users can read own dissolution requests" ON team_dissolution_requests
  FOR SELECT USING (requester_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Users can create dissolution requests
CREATE POLICY "Users can create dissolution requests" ON team_dissolution_requests
  FOR INSERT WITH CHECK (requester_id = auth.uid());

-- Only admins can update (approve/reject) dissolution requests
CREATE POLICY "Admins can update dissolution requests" ON team_dissolution_requests
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Enable RLS on teams table for creator_id access (already enabled, just add policy)
-- Allow creator to read their teams (already covered by existing policies)
