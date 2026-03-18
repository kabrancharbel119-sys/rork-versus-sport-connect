-- ============================================
-- ENSURE COMPLETE SCHEMA
-- Création/vérification complète des tables venues et bookings
-- Cette migration garantit que toutes les colonnes nécessaires existent
-- ============================================

-- ============================================
-- TABLE VENUES
-- ============================================

-- Créer la table venues si elle n'existe pas
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  sport JSONB DEFAULT '[]'::jsonb,
  price_per_hour INTEGER DEFAULT 0,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  rating NUMERIC(3,2) DEFAULT 0,
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  latitude NUMERIC,
  longitude NUMERIC,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT,
  phone TEXT,
  email TEXT,
  opening_hours JSONB,
  auto_approve BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  capacity INTEGER,
  surface_type TEXT,
  rules TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter les colonnes manquantes à venues (si la table existait déjà)
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
  
  -- created_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'created_at') THEN
    ALTER TABLE venues ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- TABLE BOOKINGS
-- ============================================

-- Créer la table bookings si elle n'existe pas
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_price INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter les colonnes manquantes à bookings (si la table existait déjà)
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
  
  -- date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'date') THEN
    ALTER TABLE bookings ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;
  
  -- start_time
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'start_time') THEN
    ALTER TABLE bookings ADD COLUMN start_time TIME NOT NULL DEFAULT '00:00:00';
  END IF;
  
  -- end_time
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'end_time') THEN
    ALTER TABLE bookings ADD COLUMN end_time TIME NOT NULL DEFAULT '00:00:00';
  END IF;
  
  -- total_price
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'total_price') THEN
    ALTER TABLE bookings ADD COLUMN total_price INTEGER NOT NULL DEFAULT 0;
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
  
  -- created_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bookings' AND column_name = 'created_at') THEN
    ALTER TABLE bookings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
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
ORDER BY ordinal_position;

-- Vérifier les colonnes de bookings
SELECT 'BOOKINGS COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;
