-- ============================================================================
-- Migration: Passage de l'authentification par téléphone à email
-- Date: 2026-03-02
-- Description: Rendre phone optionnel et email obligatoire
-- ============================================================================

-- 1. Rendre phone optionnel (n'était peut-être pas nullable)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

-- 2. Supprimer la contrainte unique sur phone si elle existe
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;

-- 3. S'assurer que email est bien NOT NULL
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- 4. Ajouter contrainte unique sur email côté users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- 5. Mettre à jour les users existants sans email valide (si nécessaire)
-- Remplacer les emails factices par de vrais emails si besoin
UPDATE users 
SET email = LOWER(username) || '@vsport.local'
WHERE email LIKE '%@local.app' OR email IS NULL;

-- 6. Commentaires
COMMENT ON COLUMN users.phone IS 'Numéro de téléphone (optionnel, peut être ajouté dans le profil)';
COMMENT ON COLUMN users.email IS 'Email (obligatoire, utilisé pour l''authentification)';

-- Afficher un message de succès
DO $$
BEGIN
  RAISE NOTICE '✅ Migration vers authentification email terminée !';
  RAISE NOTICE '✅ Phone est maintenant optionnel';
  RAISE NOTICE '✅ Email est obligatoire et unique';
END $$;
