-- Ajoute la colonne "type" à tournaments si elle n'existe pas
-- Exécuter une fois dans Supabase SQL Editor avant le seed du tournoi démo.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'knockout';
