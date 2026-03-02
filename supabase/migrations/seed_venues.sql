-- ============================================
-- SEED VENUES DATA
-- Insertion des terrains existants dans l'application
-- ============================================

-- Insertion des terrains (venues)
INSERT INTO venues (id, name, address, city, sport, price_per_hour, rating, amenities, latitude, longitude, images) VALUES
  ('venue-1', 'Stade Félix Houphouët-Boigny', 'Boulevard de la République, Plateau', 'Abidjan', '["football"]'::jsonb, 50000, 4.8, '["Vestiaires", "Parking", "Éclairage", "Tribunes"]'::jsonb, 5.3167, -4.0333, '["https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800"]'::jsonb),
  ('venue-2', 'Terrain de Cocody', 'Rue des Sports, Cocody', 'Abidjan', '["football", "basketball"]'::jsonb, 25000, 4.2, '["Vestiaires", "Parking"]'::jsonb, 5.3599, -4.0083, '["https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800"]'::jsonb),
  ('venue-3', 'Complexe Sportif de Marcory', 'Avenue Pierre Fakhoury, Marcory', 'Abidjan', '["football", "basketball", "volleyball"]'::jsonb, 35000, 4.5, '["Vestiaires", "Parking", "Éclairage", "Cafétéria"]'::jsonb, 5.3000, -3.9833, '["https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800"]'::jsonb),
  ('venue-4', 'Terrain Municipal Yopougon', 'Boulevard Principal, Yopougon', 'Abidjan', '["football"]'::jsonb, 15000, 3.8, '["Vestiaires", "Éclairage"]'::jsonb, 5.3500, -4.0833, '["https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800"]'::jsonb),
  ('venue-5', 'Palais des Sports de Treichville', 'Rue 12, Treichville', 'Abidjan', '["basketball", "volleyball", "handball"]'::jsonb, 45000, 4.6, '["Vestiaires", "Parking", "Climatisation", "Tribunes", "Sono"]'::jsonb, 5.3000, -4.0167, '["https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800"]'::jsonb),
  ('venue-6', 'Tennis Club Ivoire', 'Rue des Jardins, Deux Plateaux', 'Abidjan', '["tennis", "padel"]'::jsonb, 20000, 4.4, '["Vestiaires", "Parking", "Pro Shop", "Restaurant"]'::jsonb, 5.3700, -4.0200, '["https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800"]'::jsonb),
  ('venue-7', 'Stade Robert Champroux', 'Boulevard Latrille, Cocody', 'Abidjan', '["football", "athletics"]'::jsonb, 40000, 4.3, '["Vestiaires", "Parking", "Éclairage", "Piste d''athlétisme"]'::jsonb, 5.3650, -4.0050, '["https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800"]'::jsonb),
  ('venue-8', 'Centre Aquatique Olympique', 'Zone 4, Marcory', 'Abidjan', '["swimming"]'::jsonb, 30000, 4.7, '["Vestiaires", "Parking", "Sauna", "Coach disponible"]'::jsonb, 5.3100, -3.9900, '["https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800"]'::jsonb),
  ('venue-9', 'Gymnase de Koumassi', 'Avenue 13, Koumassi', 'Abidjan', '["basketball", "volleyball", "handball", "badminton"]'::jsonb, 20000, 4.0, '["Vestiaires", "Parking"]'::jsonb, 5.2900, -3.9500, '["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"]'::jsonb),
  ('venue-10', 'City Padel Abidjan', 'Riviera 3, Cocody', 'Abidjan', '["padel", "tennis"]'::jsonb, 25000, 4.8, '["Vestiaires", "Parking", "Bar", "Location matériel"]'::jsonb, 5.3750, -3.9800, '["https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=800"]'::jsonb),
  ('venue-11', 'Stade de Bouaké', 'Avenue de la Paix', 'Bouaké', '["football"]'::jsonb, 30000, 4.1, '["Vestiaires", "Parking", "Éclairage"]'::jsonb, 7.6833, -5.0333, '["https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800"]'::jsonb),
  ('venue-12', 'Complexe Sportif San Pedro', 'Zone Industrielle', 'San Pedro', '["football", "basketball"]'::jsonb, 25000, 4.0, '["Vestiaires", "Parking"]'::jsonb, 4.7500, -6.6333, '["https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  sport = EXCLUDED.sport,
  price_per_hour = EXCLUDED.price_per_hour,
  rating = EXCLUDED.rating,
  amenities = EXCLUDED.amenities,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  images = EXCLUDED.images;

-- Vérification
SELECT COUNT(*) as total_venues FROM venues;
