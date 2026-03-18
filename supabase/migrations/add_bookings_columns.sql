-- ============================================
-- ADD BOOKINGS COLUMNS
-- Ajout des colonnes nécessaires pour la table bookings
-- ============================================

-- Ajouter la colonne venue_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'venue_id') THEN
    ALTER TABLE bookings ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ajouter la colonne user_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'user_id') THEN
    ALTER TABLE bookings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ajouter la colonne date si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'date') THEN
    ALTER TABLE bookings ADD COLUMN date DATE NOT NULL;
  END IF;
END $$;

-- Ajouter la colonne start_time si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'start_time') THEN
    ALTER TABLE bookings ADD COLUMN start_time TIME NOT NULL;
  END IF;
END $$;

-- Ajouter la colonne end_time si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'end_time') THEN
    ALTER TABLE bookings ADD COLUMN end_time TIME NOT NULL;
  END IF;
END $$;

-- Ajouter la colonne total_price si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'total_price') THEN
    ALTER TABLE bookings ADD COLUMN total_price INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Ajouter la colonne status si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'status') THEN
    ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Ajouter la colonne match_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'match_id') THEN
    ALTER TABLE bookings ADD COLUMN match_id UUID REFERENCES matches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ajouter la colonne notes si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'notes') THEN
    ALTER TABLE bookings ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Ajouter la colonne created_at si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'created_at') THEN
    ALTER TABLE bookings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_bookings_venue_id ON bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_match_id ON bookings(match_id);

-- Vérification des colonnes ajoutées
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('venue_id', 'user_id', 'date', 'start_time', 'end_time', 'total_price', 'status', 'match_id', 'notes', 'created_at')
ORDER BY column_name;
