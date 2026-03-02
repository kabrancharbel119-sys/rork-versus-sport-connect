-- ============================================
-- CORRECTIONS DES BUGS DÉTECTÉS PAR LES TESTS E2E
-- ============================================

-- ============================================
-- BUG 3: Contraintes UNIQUE sur users
-- ============================================
DO $$ 
BEGIN
  -- Contrainte UNIQUE sur phone
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_phone_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;

  -- Contrainte UNIQUE sur username
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_username_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;

  -- Contrainte UNIQUE sur email
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;

  -- Contrainte UNIQUE sur referral_code
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_referral_code_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

-- ============================================
-- BUG 4 & 5: Contraintes CHECK sur matches
-- ============================================
DO $$ 
BEGIN
  -- Contrainte CHECK sur entry_fee (doit être >= 0)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matches_entry_fee_positive'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT matches_entry_fee_positive
      CHECK (entry_fee IS NULL OR entry_fee >= 0);
  END IF;

  -- Contrainte CHECK sur max_players (doit être > 0)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matches_max_players_positive'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT matches_max_players_positive
      CHECK (max_players IS NULL OR max_players > 0);
  END IF;

  -- Contrainte CHECK sur prize (doit être >= 0)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matches_prize_positive'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT matches_prize_positive
      CHECK (prize IS NULL OR prize >= 0);
  END IF;
END $$;

-- ============================================
-- BUG 6: RLS NOTIFICATIONS (CRITIQUE SÉCURITÉ)
-- ============================================

-- S'assurer que RLS est activé
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;

-- Un user ne voit QUE ses propres notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Un user ne peut créer que ses propres notifications
-- (En production, utiliser service_role pour créer des notifications pour d'autres users)
CREATE POLICY "notifications_insert_own"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Un user ne peut modifier que ses propres notifications
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Un user ne peut supprimer que ses propres notifications
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- VÉRIFICATIONS
-- ============================================

-- Vérifier que les contraintes sont bien créées
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint
  WHERE conname IN (
    'users_phone_key',
    'users_username_key',
    'users_email_key',
    'users_referral_code_key',
    'matches_entry_fee_positive',
    'matches_max_players_positive',
    'matches_prize_positive'
  );
  
  RAISE NOTICE 'Nombre de contraintes créées: %', constraint_count;
  
  IF constraint_count < 7 THEN
    RAISE WARNING 'Certaines contraintes n''ont pas été créées. Vérifiez les logs.';
  END IF;
END $$;

-- Vérifier que les policies RLS sont bien créées
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'notifications'
    AND policyname IN (
      'notifications_select_own',
      'notifications_insert_own',
      'notifications_update_own',
      'notifications_delete_own'
    );
  
  RAISE NOTICE 'Nombre de policies RLS créées pour notifications: %', policy_count;
  
  IF policy_count < 4 THEN
    RAISE WARNING 'Certaines policies RLS n''ont pas été créées. Vérifiez les logs.';
  END IF;
END $$;

COMMENT ON CONSTRAINT users_phone_key ON users IS 'BUG 3: Empêche les doublons de numéro de téléphone';
COMMENT ON CONSTRAINT users_username_key ON users IS 'BUG 3: Empêche les doublons de username';
COMMENT ON CONSTRAINT matches_entry_fee_positive ON matches IS 'BUG 4: Empêche les entry_fee négatifs';
COMMENT ON CONSTRAINT matches_max_players_positive ON matches IS 'BUG 5: Empêche max_players <= 0';
COMMENT ON CONSTRAINT matches_prize_positive ON matches IS 'BUG 4: Empêche les prizes négatifs';
