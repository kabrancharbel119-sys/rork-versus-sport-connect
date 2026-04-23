-- ============================================================
-- FIX_QA_WARNINGS — Résout tous les warnings détectés par le
-- rapport QA (99/100 → 100/100). Idempotent.
-- ============================================================

-- ── 1. users: colonnes i18n + profil manquantes ──────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr'
    CHECK (preferred_language IN ('fr', 'en', 'ar', 'es', 'pt')),
  ADD COLUMN IF NOT EXISTS preferred_sport    TEXT,
  ADD COLUMN IF NOT EXISTS display_name       TEXT,
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'friends', 'private'));

-- Backfill display_name = full_name pour les lignes existantes
UPDATE public.users
SET display_name = full_name
WHERE display_name IS NULL AND full_name IS NOT NULL;

-- ── 2. referrals: colonne referral_code manquante ────────────
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Backfill referral_code depuis code si disponible (sinon génère un code court)
UPDATE public.referrals
SET referral_code = COALESCE(
  (SELECT referral_code FROM public.users WHERE public.users.id = public.referrals.referrer_id LIMIT 1),
  UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8))
)
WHERE referral_code IS NULL;

-- ── 3. Index de performance: users lookup ────────────────────
-- Résout le warning latence "users" > 300ms
CREATE INDEX IF NOT EXISTS idx_users_full_name      ON public.users (full_name);
CREATE INDEX IF NOT EXISTS idx_users_username        ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_users_preferred_lang  ON public.users (preferred_language);
CREATE INDEX IF NOT EXISTS idx_users_created_at      ON public.users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_code        ON public.referrals (referral_code);

-- ── 4. users role: normaliser les valeurs invalides ──────────
-- invalid_roles=234 → ces users ont un rôle non reconnu
-- On les passe à 'user' (la valeur par défaut de l'app)
UPDATE public.users
SET role = 'user'
WHERE role NOT IN ('user', 'admin', 'venue_manager', 'player', 'coach', 'referee');

-- ── Vérification finale ───────────────────────────────────────
SELECT
  'users.preferred_language' AS col,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='preferred_language') AS present
UNION ALL SELECT 'users.preferred_sport',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='preferred_sport')
UNION ALL SELECT 'users.display_name',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='display_name')
UNION ALL SELECT 'users.profile_visibility',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_visibility')
UNION ALL SELECT 'referrals.referral_code',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referral_code');
