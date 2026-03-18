-- ============================================
-- DIAGNOSTIC VENUES TABLE
-- Vérifier l'état actuel de la table venues
-- ============================================

-- Vérifier si la table existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'venues')
    THEN 'La table venues EXISTE'
    ELSE 'La table venues N''EXISTE PAS'
  END as table_status;

-- Lister toutes les colonnes actuelles de la table venues
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'venues'
ORDER BY ordinal_position;

-- Vérifier quelles colonnes manquent parmi celles requises
SELECT 
  required_column,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'venues' AND column_name = required_column
    )
    THEN '✓ EXISTE'
    ELSE '✗ MANQUANTE'
  END as status
FROM (
  VALUES 
    ('id'),
    ('name'),
    ('address'),
    ('city'),
    ('sport'),
    ('price_per_hour'),
    ('images'),
    ('rating'),
    ('amenities'),
    ('latitude'),
    ('longitude'),
    ('owner_id'),
    ('description'),
    ('phone'),
    ('email'),
    ('opening_hours'),
    ('auto_approve'),
    ('is_active'),
    ('capacity'),
    ('surface_type'),
    ('rules'),
    ('created_at')
) AS required(required_column)
ORDER BY required_column;

-- Compter le nombre de terrains existants
SELECT COUNT(*) as total_venues FROM venues;

-- Afficher quelques exemples de terrains (si la table existe et a des données)
SELECT id, name, city, rating, price_per_hour 
FROM venues 
LIMIT 5;
