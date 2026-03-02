-- Migration: champs tournoi sur les matchs (phase, lien tournoi)
-- Exécuter dans le SQL Editor Supabase si les colonnes n'existent pas.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS round_label TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
