-- =============================================
-- TEAM CM SYSTEM — Community Manager management
-- Tracks CM assignments with permissions & status
-- 100% idempotent & safe
-- =============================================

CREATE TABLE IF NOT EXISTS team_cm_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  permissions JSONB NOT NULL DEFAULT '{"can_post": true, "can_delete_posts": false, "can_manage_photos": true, "can_pin_posts": false}'::jsonb,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  UNIQUE(team_id, user_id)
);

-- =============================================
-- RLS
-- =============================================
DO $$ BEGIN ALTER TABLE team_cm_assignments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Public read: anyone can see CM assignments (for display)
DO $$ BEGIN
  CREATE POLICY "CM assignments are viewable by everyone"
  ON team_cm_assignments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert: only captain of the team
DO $$ BEGIN
  CREATE POLICY "Captain can assign CMs"
  ON team_cm_assignments FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_cm_assignments.team_id
      AND t.captain_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update: only captain
DO $$ BEGIN
  CREATE POLICY "Captain can update CM assignments"
  ON team_cm_assignments FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_cm_assignments.team_id
      AND t.captain_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Delete: only captain
DO $$ BEGIN
  CREATE POLICY "Captain can delete CM assignments"
  ON team_cm_assignments FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_cm_assignments.team_id
      AND t.captain_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_cm_assignments_team ON team_cm_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_cm_assignments_user ON team_cm_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_assignments_active ON team_cm_assignments(team_id, status) WHERE status = 'active';

-- =============================================
-- TRIGGER: Sync members role when CM assignment changes
-- When a CM is assigned, set member role to 'cm'
-- When a CM is removed/suspended, set member role back to 'member'
-- =============================================

CREATE OR REPLACE FUNCTION sync_cm_member_role()
RETURNS TRIGGER AS $$
DECLARE
  v_captain_id UUID;
BEGIN
  SELECT captain_id INTO v_captain_id FROM teams WHERE id = NEW.team_id;
  
  -- Update the members array in teams table
  UPDATE teams
  SET members = (
    SELECT jsonb_agg(
      CASE
        WHEN m->>'userId' = NEW.user_id::text THEN
          jsonb_set(m, '{role}', to_jsonb(
            CASE WHEN NEW.status = 'active' THEN 'cm' ELSE 'member' END
          ))
        ELSE m
      END
    )
    FROM jsonb_array_elements(members) m
  )
  WHERE id = NEW.team_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_sync_cm_member_role_insert
  AFTER INSERT ON team_cm_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_cm_member_role();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_sync_cm_member_role_update
  AFTER UPDATE ON team_cm_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_cm_member_role();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_sync_cm_member_role_delete
  AFTER DELETE ON team_cm_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_cm_member_role();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- Update team_posts RLS to also check CM assignments table
-- (in addition to the existing members role check)
-- =============================================

-- Drop old insert policy and recreate with CM assignments check
DO $$ BEGIN
  DROP POLICY IF EXISTS "Team members can insert team posts" ON team_posts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

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
        OR EXISTS (
          SELECT 1 FROM team_cm_assignments cma
          WHERE cma.team_id = team_posts.team_id
          AND cma.user_id = auth.uid()
          AND cma.status = 'active'
          AND (cma.permissions->>'can_post')::boolean = true
        )
      )
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update delete policy to also allow CMs with can_delete_posts permission
DO $$ BEGIN
  DROP POLICY IF EXISTS "Captain or author can delete team posts" ON team_posts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Captain, author, or CM can delete team posts"
  ON team_posts FOR DELETE USING (
    team_posts.author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_posts.team_id AND t.captain_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_cm_assignments cma
      WHERE cma.team_id = team_posts.team_id
      AND cma.user_id = auth.uid()
      AND cma.status = 'active'
      AND (cma.permissions->>'can_delete_posts')::boolean = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
