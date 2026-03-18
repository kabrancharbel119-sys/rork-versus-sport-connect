-- ============================================
-- FIX SCHEMA SAFELY
-- Version corrigée qui gère les erreurs de timestamp
-- ============================================

-- ============================================
-- TABLE VENUES - Colonnes manquantes
-- ============================================

DO $$ 
BEGIN
  -- auto_approve
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'auto_approve') THEN
    ALTER TABLE venues ADD COLUMN auto_approve BOOLEAN DEFAULT true;
  END IF;
  
  -- is_active
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'is_active') THEN
    ALTER TABLE venues ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  -- capacity
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'capacity') THEN
    ALTER TABLE venues ADD COLUMN capacity INTEGER;
  END IF;
  
  -- surface_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'surface_type') THEN
    ALTER TABLE venues ADD COLUMN surface_type TEXT;
  END IF;
  
  -- rules
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'rules') THEN
    ALTER TABLE venues ADD COLUMN rules TEXT;
  END IF;
  
  -- opening_hours
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'opening_hours') THEN
    ALTER TABLE venues ADD COLUMN opening_hours JSONB;
  END IF;
  
  -- phone
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'phone') THEN
    ALTER TABLE venues ADD COLUMN phone TEXT;
  END IF;
  
  -- email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'email') THEN
    ALTER TABLE venues ADD COLUMN email TEXT;
  END IF;
  
  -- description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'description') THEN
    ALTER TABLE venues ADD COLUMN description TEXT;
  END IF;
  
  -- owner_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'owner_id') THEN
    ALTER TABLE venues ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- created_at (nullable d'abord, puis on met une valeur par défaut)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'created_at') THEN
    ALTER TABLE venues ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE venues SET created_at = NOW() WHERE created_at IS NULL;
    ALTER TABLE venues ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- TABLE BOOKINGS - Colonnes manquantes
-- ============================================

DO $$ 
BEGIN
  -- venue_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'venue_id') THEN
    ALTER TABLE bookings ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE CASCADE;
  END IF;
  
  -- user_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'user_id') THEN
    ALTER TABLE bookings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- date (nullable d'abord)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'date') THEN
    ALTER TABLE bookings ADD COLUMN date DATE;
    UPDATE bookings SET date = CURRENT_DATE WHERE date IS NULL;
    ALTER TABLE bookings ALTER COLUMN date SET NOT NULL;
    ALTER TABLE bookings ALTER COLUMN date SET DEFAULT CURRENT_DATE;
  END IF;
  
  -- start_time (nullable d'abord)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'start_time') THEN
    ALTER TABLE bookings ADD COLUMN start_time TIME;
    UPDATE bookings SET start_time = '00:00:00' WHERE start_time IS NULL;
    ALTER TABLE bookings ALTER COLUMN start_time SET NOT NULL;
    ALTER TABLE bookings ALTER COLUMN start_time SET DEFAULT '00:00:00';
  END IF;
  
  -- end_time (nullable d'abord)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'end_time') THEN
    ALTER TABLE bookings ADD COLUMN end_time TIME;
    UPDATE bookings SET end_time = '00:00:00' WHERE end_time IS NULL;
    ALTER TABLE bookings ALTER COLUMN end_time SET NOT NULL;
    ALTER TABLE bookings ALTER COLUMN end_time SET DEFAULT '00:00:00';
  END IF;
  
  -- total_price
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'total_price') THEN
    ALTER TABLE bookings ADD COLUMN total_price INTEGER DEFAULT 0;
    UPDATE bookings SET total_price = 0 WHERE total_price IS NULL;
    ALTER TABLE bookings ALTER COLUMN total_price SET NOT NULL;
  END IF;
  
  -- status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'status') THEN
    ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
  
  -- match_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'match_id') THEN
    ALTER TABLE bookings ADD COLUMN match_id UUID;
  END IF;
  
  -- notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'notes') THEN
    ALTER TABLE bookings ADD COLUMN notes TEXT;
  END IF;
  
  -- created_at (nullable d'abord, puis on met une valeur par défaut)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'created_at') THEN
    ALTER TABLE bookings ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE bookings SET created_at = NOW() WHERE created_at IS NULL;
    ALTER TABLE bookings ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- INDEX CREATION
-- ============================================

-- Index pour venues
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_sport ON venues USING GIN(sport);
CREATE INDEX IF NOT EXISTS idx_venues_rating ON venues(rating DESC);
CREATE INDEX IF NOT EXISTS idx_venues_is_active ON venues(is_active);
CREATE INDEX IF NOT EXISTS idx_venues_auto_approve ON venues(auto_approve);
CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON venues(owner_id);

-- Index pour bookings
CREATE INDEX IF NOT EXISTS idx_bookings_venue_id ON bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_match_id ON bookings(match_id);

-- ============================================
-- VÉRIFICATION FINALE
-- ============================================

-- Vérifier les colonnes de venues
SELECT 'VENUES COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'venues'
  AND column_name IN ('auto_approve', 'is_active', 'capacity', 'surface_type', 'rules', 'opening_hours', 'phone', 'email', 'description', 'owner_id', 'created_at')
ORDER BY column_name;

-- Vérifier les colonnes de bookings
SELECT 'BOOKINGS COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('venue_id', 'user_id', 'date', 'start_time', 'end_time', 'total_price', 'status', 'match_id', 'notes', 'created_at')
ORDER BY column_name;
