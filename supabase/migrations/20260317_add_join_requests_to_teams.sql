-- Add join_requests column to teams table
-- This column stores pending/accepted/rejected join requests as JSONB array

ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS join_requests JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN teams.join_requests IS 'Array of join request objects with structure: {id, userId, teamId, message, status, compatibilityScore, createdAt, respondedAt}';

-- Create index for better query performance on join requests
CREATE INDEX IF NOT EXISTS idx_teams_join_requests ON teams USING GIN (join_requests);
