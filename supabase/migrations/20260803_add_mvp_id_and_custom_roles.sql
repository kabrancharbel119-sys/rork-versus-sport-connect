-- Fixe la dérive de schéma détectée par la suite e2e (__tests__/e2e) :
-- lib/api/matches.ts lit row.mvp_id et lib/api/teams.ts lit row.custom_roles,
-- mais ces colonnes n'ont jamais été créées en base.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'mvp_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN mvp_id UUID REFERENCES users(id) ON DELETE SET NULL;
    RAISE NOTICE 'matches.mvp_id added';
  ELSE
    RAISE NOTICE 'matches.mvp_id already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'custom_roles'
  ) THEN
    ALTER TABLE teams ADD COLUMN custom_roles JSONB NOT NULL DEFAULT '[]'::jsonb;
    RAISE NOTICE 'teams.custom_roles added';
  ELSE
    RAISE NOTICE 'teams.custom_roles already exists';
  END IF;
END $$;
