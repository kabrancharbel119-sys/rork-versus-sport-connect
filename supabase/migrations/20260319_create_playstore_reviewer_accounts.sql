-- =============================================
-- PLAY STORE REVIEWER ACCOUNTS
-- Crée/maintient 3 comptes de test pour la review Google Play:
-- - 1 compte utilisateur
-- - 1 compte gestionnaire de terrain (venue_manager)
-- - 1 compte admin
--
-- Mots de passe review (hash legacy SHA256 + salt app):
--   user: PlayUser#2026
--   manager: PlayManager#2026
--   admin: PlayAdmin#2026
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- IMPORTANT: créer d'abord les comptes dans Authentication > Users,
-- puis exécuter cette migration pour synchroniser vers public.users.

INSERT INTO users (
  id,
  email,
  username,
  full_name,
  phone,
  password_hash,
  city,
  country,
  role,
  is_verified,
  is_premium,
  is_banned,
  referral_code,
  created_at
)
SELECT
  au.id,
  'review.user1@versus-sport.com',
  'review_user1',
  'Google Review User One',
  '+15145550001',
  encode(digest('PlayUser#2026' || 'vs_salt_2024', 'sha256'), 'hex'),
  'Montreal',
  'Canada',
  'user',
  true,
  false,
  false,
  'VSRVWU1',
  NOW()
FROM auth.users au
WHERE au.email = 'review.user1@versus-sport.com'
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  is_premium = EXCLUDED.is_premium,
  is_banned = EXCLUDED.is_banned,
  referral_code = EXCLUDED.referral_code;

INSERT INTO users (
  id,
  email,
  username,
  full_name,
  phone,
  password_hash,
  city,
  country,
  role,
  is_verified,
  is_premium,
  is_banned,
  referral_code,
  created_at
)
SELECT
  au.id,
  'review.manager@versus-sport.com',
  'review_manager',
  'Google Review Venue Manager',
  '+15145550002',
  encode(digest('PlayManager#2026' || 'vs_salt_2024', 'sha256'), 'hex'),
  'Montreal',
  'Canada',
  'venue_manager',
  true,
  false,
  false,
  'VSRVWMG',
  NOW()
FROM auth.users au
WHERE au.email = 'review.manager@versus-sport.com'
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  is_premium = EXCLUDED.is_premium,
  is_banned = EXCLUDED.is_banned,
  referral_code = EXCLUDED.referral_code;

INSERT INTO users (
  id,
  email,
  username,
  full_name,
  phone,
  password_hash,
  city,
  country,
  role,
  is_verified,
  is_premium,
  is_banned,
  referral_code,
  created_at
)
SELECT
  au.id,
  'review.admin@versus-sport.com',
  'review_admin',
  'Google Review Admin',
  '+15145550003',
  encode(digest('PlayAdmin#2026' || 'vs_salt_2024', 'sha256'), 'hex'),
  'Montreal',
  'Canada',
  'admin',
  true,
  true,
  false,
  'VSRVWAD',
  NOW()
FROM auth.users au
WHERE au.email = 'review.admin@versus-sport.com'
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  is_premium = EXCLUDED.is_premium,
  is_banned = EXCLUDED.is_banned,
  referral_code = EXCLUDED.referral_code;
