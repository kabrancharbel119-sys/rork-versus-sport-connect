-- ══════════════════════════════════════════════════════════════
-- MIGRATION: Passage de l'authentification par téléphone à email
-- ══════════════════════════════════════════════════════════════
-- Date: 2026-03-02
-- Description: Rend le champ phone optionnel et email obligatoire
-- ══════════════════════════════════════════════════════════════

-- 1. Rendre phone optionnel (n'était peut-être pas nullable)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

-- 2. Supprimer la contrainte unique sur phone si elle existe
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;

-- 3. S'assurer que email est bien unique et NOT NULL
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- 4. Ajouter une contrainte unique sur email si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- 5. Créer un index sur email pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 6. Mettre à jour les emails factices existants (optionnel)
-- Cette requête peut être exécutée pour nettoyer les emails générés automatiquement
-- UPDATE users 
-- SET email = LOWER(username) || '@vsport.app' 
-- WHERE email LIKE '%@local.app';

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATIONS POST-MIGRATION
-- ══════════════════════════════════════════════════════════════

-- Vérifier que email est NOT NULL
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'email';

-- Vérifier que phone est nullable
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'phone';

-- Vérifier les contraintes uniques
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass 
AND conname IN ('users_email_unique', 'users_phone_unique', 'users_phone_key');
