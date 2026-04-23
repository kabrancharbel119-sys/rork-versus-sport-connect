-- ============================================================
-- FIX ALL MISSING COLUMNS (pre-production patch)
-- Applique toutes les colonnes manquantes détectées par le
-- rapport pré-production. Toutes les instructions utilisent
-- IF NOT EXISTS pour être idempotentes.
-- ============================================================

-- ── 1. users ban columns ──────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS ban_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS users_banned_until_idx ON public.users (banned_until);

-- ── 2. users.is_profile_visible (visibilité profil) ──────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_profile_visible BOOLEAN NOT NULL DEFAULT true;

-- ── 3. users.can_create_ranked_matches ───────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS can_create_ranked_matches BOOLEAN NOT NULL DEFAULT false;

-- ── 4. teams.co_captain_ids (co-capitaines) ──────────────────
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS co_captain_ids JSONB DEFAULT '[]'::jsonb;

-- ── 5. verification_requests.type ────────────────────────────
-- La table originale n'a pas de colonne "type" (elle a document_type).
-- On ajoute "type" comme alias fonctionnel.
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'player'
  CHECK (type IN ('player', 'coach', 'referee', 'team_captain', 'venue_owner'));

-- Remplir type depuis document_type pour les lignes existantes
UPDATE public.verification_requests
SET type = 'player'
WHERE type IS NULL;

-- ── 6. venues.max_advance_days ───────────────────────────────
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS max_advance_days INTEGER NOT NULL DEFAULT 30;

-- ── 7. venues.cancellation_hours (au cas où absente) ─────────
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS cancellation_hours INTEGER NOT NULL DEFAULT 24;

-- ── 8. venues.pending_status ─────────────────────────────────
-- "pending_status" sur venues = terrain en attente d'approbation admin
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS pending_status TEXT DEFAULT 'approved'
  CHECK (pending_status IN ('pending', 'approved', 'rejected'));

-- ── Index utiles ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_is_profile_visible ON public.users (is_profile_visible);
CREATE INDEX IF NOT EXISTS idx_venues_pending_status ON public.venues (pending_status);
CREATE INDEX IF NOT EXISTS idx_venues_max_advance_days ON public.venues (max_advance_days);

-- ── Vérification finale ───────────────────────────────────────
SELECT
  'users.ban_metadata'        AS col, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users'                  AND column_name='ban_metadata')        AS present
UNION ALL SELECT
  'users.is_profile_visible',           EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users'                  AND column_name='is_profile_visible')
UNION ALL SELECT
  'users.can_create_ranked_matches',    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users'                  AND column_name='can_create_ranked_matches')
UNION ALL SELECT
  'teams.co_captain_ids',               EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='teams'                 AND column_name='co_captain_ids')
UNION ALL SELECT
  'verification_requests.type',         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='verification_requests' AND column_name='type')
UNION ALL SELECT
  'venues.max_advance_days',            EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='venues'               AND column_name='max_advance_days')
UNION ALL SELECT
  'venues.cancellation_hours',          EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='venues'               AND column_name='cancellation_hours')
UNION ALL SELECT
  'venues.pending_status',              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='venues'               AND column_name='pending_status');
