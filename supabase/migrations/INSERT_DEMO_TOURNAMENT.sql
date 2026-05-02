-- ============================================================
-- Tournoi DÉMO — insertion uniquement du tournoi
-- Les équipes et matchs sont mockés dans le code (lib/demo-data.ts)
-- Idempotent : peut être relancé sans erreur
-- ============================================================

-- 0. Colonne is_demo
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

INSERT INTO tournaments (
  id, name, description, sport, format, type, status, level,
  max_teams, registered_teams, entry_fee, prize_pool, prizes,
  start_date, end_date, winner_id, created_by, is_demo
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '🏆 Coupe VS Sport — Exemple',
  'Tournoi exemple pour montrer le déroulement complet : inscriptions → quarts de finale → demi-finales → finale. Les Lions FC ont remporté le titre après 3 matchs dominés. Créez votre propre tournoi et vivez la même expérience !',
  'football', '5v5', 'knockout', 'completed', 'intermediate',
  8,
  '["b0000000-0000-0000-0000-000000000001","b0000000-0000-0000-0000-000000000002","b0000000-0000-0000-0000-000000000003","b0000000-0000-0000-0000-000000000004","b0000000-0000-0000-0000-000000000005","b0000000-0000-0000-0000-000000000006","b0000000-0000-0000-0000-000000000007","b0000000-0000-0000-0000-000000000008"]'::jsonb,
  2000, 50000,
  '[{"position":1,"amount":30000,"label":"Champion"},{"position":2,"amount":15000,"label":"Finaliste"},{"position":3,"amount":5000,"label":"3ème place"}]'::jsonb,
  NOW() - INTERVAL '25 days',
  NOW() - INTERVAL '18 days',
  'b0000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  is_demo   = TRUE,
  status    = 'completed',
  winner_id = 'b0000000-0000-0000-0000-000000000001';
