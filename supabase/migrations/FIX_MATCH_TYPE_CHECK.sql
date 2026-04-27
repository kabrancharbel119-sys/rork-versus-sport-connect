-- =============================================================================
-- Fix : contrainte CHECK sur matches.match_type
-- Valeurs autorisées : friendly | ranked | tournament
-- =============================================================================

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_match_type_check;

-- Réappliquer avec toutes les valeurs valides du code
ALTER TABLE matches
  ADD CONSTRAINT matches_match_type_check
  CHECK (match_type IN ('friendly', 'ranked', 'tournament'));

-- Mettre à jour les lignes NULL ou invalides vers 'friendly' (sécurité)
UPDATE matches
  SET match_type = 'friendly'
  WHERE match_type IS NULL
     OR match_type NOT IN ('friendly', 'ranked', 'tournament');

-- Même chose pour la colonne "type" si elle existe et a une contrainte similaire
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'type'
  ) THEN
    ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_type_check;
    ALTER TABLE matches
      ADD CONSTRAINT matches_type_check
      CHECK (type IN ('friendly', 'ranked', 'tournament'));
    UPDATE matches
      SET type = 'friendly'
      WHERE type IS NULL
         OR type NOT IN ('friendly', 'ranked', 'tournament');
  END IF;
END $$;
