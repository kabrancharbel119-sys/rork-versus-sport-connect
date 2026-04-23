-- Migration: Cancel matches with no venue_id
-- These are data integrity issues (race condition during creation rollback)
-- Safe to run multiple times (idempotent)

-- 1. Annuler les matchs actifs sans venue_id (ne pas supprimer pour garder l'historique)
UPDATE matches
SET status = 'cancelled'
WHERE venue_id IS NULL
  AND status NOT IN ('cancelled', 'completed');

-- 2. Vérification post-migration
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM matches
  WHERE venue_id IS NULL
    AND status NOT IN ('cancelled', 'completed');

  IF remaining > 0 THEN
    RAISE WARNING 'FIX_MATCHES_NO_VENUE: % matches still active without venue_id', remaining;
  ELSE
    RAISE NOTICE 'FIX_MATCHES_NO_VENUE: OK — tous les matchs sans venue_id sont annulés';
  END IF;
END $$;
