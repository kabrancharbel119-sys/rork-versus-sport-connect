-- =============================================
-- ÉQUIPES DE TEST (pour tester la gestion des tournois)
-- =============================================
-- Exécuter dans Supabase : SQL Editor > New query > Coller > Run.
-- Crée 8 équipes de test (football) pour les tournois et le matchmaking.
-- =============================================

-- 1) Ajouter les colonnes manquantes si votre table teams a une structure minimale
ALTER TABLE teams ADD COLUMN IF NOT EXISTS format TEXT DEFAULT '11v11';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediate';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS ambiance TEXT DEFAULT 'competitive';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';

-- 2) Insérer les équipes (captain_id = premier user, ou NULL)
INSERT INTO teams (id, name, sport, format, level, ambiance, city, country, description, captain_id, created_at)
VALUES
  ('d1000000-0000-4000-8000-000000000001'::uuid, 'Les Aigles FC', 'football', '11v11', 'intermediate', 'competitive', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW()),
  ('d1000000-0000-4000-8000-000000000002'::uuid, 'Strikers United', 'football', '11v11', 'intermediate', 'competitive', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW()),
  ('d1000000-0000-4000-8000-000000000003'::uuid, 'Racing Club Test', 'football', '11v11', 'beginner', 'friendly', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW()),
  ('d1000000-0000-4000-8000-000000000004'::uuid, 'Dynamo Sport', 'football', '11v11', 'intermediate', 'competitive', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW()),
  ('d1000000-0000-4000-8000-000000000005'::uuid, 'Phoenix FC', 'football', '11v11', 'advanced', 'competitive', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW()),
  ('d1000000-0000-4000-8000-000000000006'::uuid, 'Thunder FC', 'football', '11v11', 'beginner', 'friendly', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW()),
  ('d1000000-0000-4000-8000-000000000007'::uuid, 'Victory Eleven', 'football', '11v11', 'intermediate', 'competitive', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW()),
  ('d1000000-0000-4000-8000-000000000008'::uuid, 'Alliance Sport', 'football', '11v11', 'beginner', 'friendly', 'Abidjan', 'Côte d''Ivoire', 'Équipe test tournoi', (SELECT id FROM users LIMIT 1), NOW())
ON CONFLICT (id) DO NOTHING;

-- Vérification
SELECT id, name, sport, city FROM teams WHERE id IN (
  'd1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-000000000004',
  'd1000000-0000-4000-8000-000000000005',
  'd1000000-0000-4000-8000-000000000006',
  'd1000000-0000-4000-8000-000000000007',
  'd1000000-0000-4000-8000-000000000008'
);
