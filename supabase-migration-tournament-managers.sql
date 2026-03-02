-- Migration : colonne managers sur tournaments
-- Permet au créateur d'autoriser d'autres utilisateurs à gérer le tournoi.
-- Exécuter dans Supabase : SQL Editor > New query > Coller > Run.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS managers JSONB DEFAULT '[]'::jsonb;
