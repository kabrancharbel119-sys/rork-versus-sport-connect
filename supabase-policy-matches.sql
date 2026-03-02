-- =============================================
-- FIX RLS MATCHES - Compatible auth custom (anon)
-- =============================================
-- L'app utilise une auth custom (pas Supabase Auth),
-- donc toutes les requêtes arrivent en tant que "anon".
-- Ce script ouvre les permissions pour le rôle anon.
--
-- Exécuter dans Supabase : SQL Editor > New query > Coller > Run.
-- =============================================

-- 1) Supprimer TOUTES les anciennes policies sur matches
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'matches'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON matches', pol.policyname);
    RAISE NOTICE 'Dropped: %', pol.policyname;
  END LOOP;
END $$;

-- 2) S'assurer que RLS est activé
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 3) Policies ouvertes (anon + authenticated)
CREATE POLICY "matches_select" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_insert" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "matches_update" ON matches FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "matches_delete" ON matches FOR DELETE USING (true);

-- 4) Même chose pour tournaments (au cas où)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'tournaments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tournaments', pol.policyname);
    RAISE NOTICE 'Dropped: %', pol.policyname;
  END LOOP;
END $$;

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "tournaments_delete" ON tournaments FOR DELETE USING (true);

-- 5) Et pour teams / users (lecture + update)
DO $$
DECLARE
  pol RECORD;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['teams', 'users', 'venues']
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE USING (true)', tbl, tbl);
    RAISE NOTICE 'Policies set for: %', tbl;
  END LOOP;
END $$;

-- 6) Vérification
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('matches', 'tournaments', 'teams', 'users', 'venues')
ORDER BY tablename, cmd;
