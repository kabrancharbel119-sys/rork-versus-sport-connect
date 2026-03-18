-- ============================================
-- ADD VENUE MANAGER COLUMNS
-- Ajout des colonnes nécessaires pour la gestion des terrains
-- ============================================

-- Ajouter la colonne auto_approve si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'auto_approve') THEN
    ALTER TABLE venues ADD COLUMN auto_approve BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Ajouter la colonne is_active si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'is_active') THEN
    ALTER TABLE venues ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Ajouter la colonne capacity si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'capacity') THEN
    ALTER TABLE venues ADD COLUMN capacity INTEGER;
  END IF;
END $$;

-- Ajouter la colonne surface_type si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'surface_type') THEN
    ALTER TABLE venues ADD COLUMN surface_type TEXT;
  END IF;
END $$;

-- Ajouter la colonne rules si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'rules') THEN
    ALTER TABLE venues ADD COLUMN rules TEXT;
  END IF;
END $$;

-- Ajouter la colonne opening_hours si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'opening_hours') THEN
    ALTER TABLE venues ADD COLUMN opening_hours JSONB;
  END IF;
END $$;

-- Ajouter la colonne phone si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'phone') THEN
    ALTER TABLE venues ADD COLUMN phone TEXT;
  END IF;
END $$;

-- Ajouter la colonne email si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'email') THEN
    ALTER TABLE venues ADD COLUMN email TEXT;
  END IF;
END $$;

-- Ajouter la colonne description si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'description') THEN
    ALTER TABLE venues ADD COLUMN description TEXT;
  END IF;
END $$;

-- Ajouter la colonne owner_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'owner_id') THEN
    ALTER TABLE venues ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ajouter la colonne created_at si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'created_at') THEN
    ALTER TABLE venues ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_venues_is_active ON venues(is_active);
CREATE INDEX IF NOT EXISTS idx_venues_auto_approve ON venues(auto_approve);

-- Créer un index sur owner_id pour les requêtes de gestionnaires
CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON venues(owner_id);

-- Vérification des colonnes ajoutées
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'venues'
  AND column_name IN ('auto_approve', 'is_active', 'capacity', 'surface_type', 'rules', 'opening_hours', 'phone', 'email', 'description', 'owner_id', 'created_at')
ORDER BY column_name;
