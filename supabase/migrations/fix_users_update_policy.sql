-- ============================================
-- CORRECTION: Policy UPDATE users pour permettre modification profil
-- ============================================

-- Supprimer l'ancienne policy UPDATE
DROP POLICY IF EXISTS "users_update_own" ON users;

-- Nouvelle policy : un user peut modifier son propre profil
-- USING contrôle qui peut être modifié (auth.uid() = id)
-- WITH CHECK contrôle les nouvelles valeurs (auth.uid() = id)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "users_update_own" ON users IS 'Un user peut modifier son propre profil uniquement';

-- Note: Les champs protégés (role, is_verified, is_premium) doivent être
-- filtrés côté application dans lib/api/auth.ts
-- Seul service_role (supabaseAdmin) peut modifier ces champs
