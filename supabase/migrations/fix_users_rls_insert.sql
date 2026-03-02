-- ============================================
-- CORRECTION: Permettre l'insertion d'utilisateurs
-- ============================================

-- Supprimer TOUTES les anciennes policies
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
DROP POLICY IF EXISTS "users_insert_signup" ON users;
DROP POLICY IF EXISTS "users_select_all" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_delete_admin_only" ON users;

-- Policy pour permettre l'insertion (signup)
-- Tout le monde peut s'inscrire (créer un user)
CREATE POLICY "users_insert_signup"
  ON users FOR INSERT
  WITH CHECK (true);

-- Policy pour permettre la lecture de tous les users
CREATE POLICY "users_select_all"
  ON users FOR SELECT
  USING (true);

-- Policy pour permettre la mise à jour de son propre profil uniquement
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Policy pour empêcher la suppression (sauf admin)
CREATE POLICY "users_delete_admin_only"
  ON users FOR DELETE
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON POLICY "users_insert_signup" ON users IS 'Permet à quiconque de créer un compte (signup)';
COMMENT ON POLICY "users_select_all" ON users IS 'Tout le monde peut voir les profils publics';
COMMENT ON POLICY "users_update_own" ON users IS 'Un user ne peut modifier que son propre profil';
COMMENT ON POLICY "users_delete_admin_only" ON users IS 'Seul service_role peut supprimer des users';
