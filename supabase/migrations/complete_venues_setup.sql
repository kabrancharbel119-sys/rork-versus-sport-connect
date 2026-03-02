-- ============================================
-- COMPLETE VENUES SETUP
-- Création de la table venues et insertion des données
-- ============================================

-- Vérifier et ajouter les colonnes manquantes à la table venues existante
-- Ajouter la colonne sport si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'sport') THEN
    ALTER TABLE venues ADD COLUMN sport JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Ajouter la colonne price_per_hour si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'price_per_hour') THEN
    ALTER TABLE venues ADD COLUMN price_per_hour INTEGER DEFAULT 0;
  END IF;
END $$;

-- Ajouter la colonne rating si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'rating') THEN
    ALTER TABLE venues ADD COLUMN rating NUMERIC(3,2) DEFAULT 0;
  END IF;
END $$;

-- Ajouter la colonne amenities si elle n'existe pas (type text[])
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'amenities') THEN
    ALTER TABLE venues ADD COLUMN amenities TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Ajouter la colonne images si elle n'existe pas (type text[])
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'venues' AND column_name = 'images') THEN
    ALTER TABLE venues ADD COLUMN images TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_sport ON venues USING GIN(sport);
CREATE INDEX IF NOT EXISTS idx_venues_rating ON venues(rating DESC);

-- Vider la table avant l'insertion pour éviter les doublons
-- Décommentez la ligne suivante si vous voulez réinitialiser complètement les terrains
-- TRUNCATE TABLE venues CASCADE;

-- Insertion des terrains (venues) avec UUID générés automatiquement
-- Note: Si des terrains existent déjà, cette insertion échouera sur les doublons
-- Pour réinitialiser, décommentez la ligne TRUNCATE ci-dessus
INSERT INTO venues (name, address, city, sport, price_per_hour, rating, amenities, latitude, longitude, images)
SELECT * FROM (VALUES
  ('Stade Félix Houphouët-Boigny', 'Boulevard de la République, Plateau', 'Abidjan', '["football"]'::jsonb, 50000, 4.8, ARRAY['Vestiaires', 'Parking', 'Éclairage', 'Tribunes'], 5.3167, -4.0333, ARRAY['https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800']),
  ('Terrain de Cocody', 'Rue des Sports, Cocody', 'Abidjan', '["football", "basketball"]'::jsonb, 25000, 4.2, ARRAY['Vestiaires', 'Parking'], 5.3599, -4.0083, ARRAY['https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800']),
  ('Complexe Sportif de Marcory', 'Avenue Pierre Fakhoury, Marcory', 'Abidjan', '["football", "basketball", "volleyball"]'::jsonb, 35000, 4.5, ARRAY['Vestiaires', 'Parking', 'Éclairage', 'Cafétéria'], 5.3000, -3.9833, ARRAY['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800']),
  ('Terrain Municipal Yopougon', 'Boulevard Principal, Yopougon', 'Abidjan', '["football"]'::jsonb, 15000, 3.8, ARRAY['Vestiaires', 'Éclairage'], 5.3500, -4.0833, ARRAY['https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800']),
  ('Palais des Sports de Treichville', 'Rue 12, Treichville', 'Abidjan', '["basketball", "volleyball", "handball"]'::jsonb, 45000, 4.6, ARRAY['Vestiaires', 'Parking', 'Climatisation', 'Tribunes', 'Sono'], 5.3000, -4.0167, ARRAY['https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800']),
  ('Tennis Club Ivoire', 'Rue des Jardins, Deux Plateaux', 'Abidjan', '["tennis", "padel"]'::jsonb, 20000, 4.4, ARRAY['Vestiaires', 'Parking', 'Pro Shop', 'Restaurant'], 5.3700, -4.0200, ARRAY['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800']),
  ('Stade Robert Champroux', 'Boulevard Latrille, Cocody', 'Abidjan', '["football", "athletics"]'::jsonb, 40000, 4.3, ARRAY['Vestiaires', 'Parking', 'Éclairage', 'Piste d''athlétisme'], 5.3650, -4.0050, ARRAY['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800']),
  ('Centre Aquatique Olympique', 'Zone 4, Marcory', 'Abidjan', '["swimming"]'::jsonb, 30000, 4.7, ARRAY['Vestiaires', 'Parking', 'Sauna', 'Coach disponible'], 5.3100, -3.9900, ARRAY['https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800']),
  ('Gymnase de Koumassi', 'Avenue 13, Koumassi', 'Abidjan', '["basketball", "volleyball", "handball", "badminton"]'::jsonb, 20000, 4.0, ARRAY['Vestiaires', 'Parking'], 5.2900, -3.9500, ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800']),
  ('City Padel Abidjan', 'Riviera 3, Cocody', 'Abidjan', '["padel", "tennis"]'::jsonb, 25000, 4.8, ARRAY['Vestiaires', 'Parking', 'Bar', 'Location matériel'], 5.3750, -3.9800, ARRAY['https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=800']),
  ('Stade de Bouaké', 'Avenue de la Paix', 'Bouaké', '["football"]'::jsonb, 30000, 4.1, ARRAY['Vestiaires', 'Parking', 'Éclairage'], 7.6833, -5.0333, ARRAY['https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800']),
  ('Complexe Sportif San Pedro', 'Zone Industrielle', 'San Pedro', '["football", "basketball"]'::jsonb, 25000, 4.0, ARRAY['Vestiaires', 'Parking'], 4.7500, -6.6333, ARRAY['https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800'])
) AS v(name, address, city, sport, price_per_hour, rating, amenities, latitude, longitude, images)
WHERE NOT EXISTS (
  SELECT 1 FROM venues WHERE venues.name = v.name AND venues.city = v.city
);

-- Vérification des données insérées
SELECT 
  COUNT(*) as total_venues,
  COUNT(DISTINCT city) as total_cities,
  ROUND(AVG(rating), 2) as average_rating
FROM venues;

-- Afficher tous les terrains insérés
SELECT id, name, city, sport, rating FROM venues ORDER BY city, name;
