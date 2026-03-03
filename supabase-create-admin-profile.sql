-- ══════════════════════════════════════════════════════════════
-- CRÉER LE PROFIL ADMIN DANS public.users
-- ══════════════════════════════════════════════════════════════
-- Le compte existe dans auth.users mais pas dans public.users
-- UUID : f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.users (
  id,
  email,
  username,
  full_name,
  phone,
  city,
  country,
  role,
  is_verified,
  is_premium,
  referral_code,
  stats,
  bio,
  created_at,
  updated_at
) VALUES (
  'f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055',
  'kabrancharbel@gmail.com',
  'charbel_kabran',
  'Charbel Kabran',
  '+14385089540',
  'Abidjan',
  'Côte d''Ivoire',
  'admin',
  true,
  true,
  'VSADMIN',
  jsonb_build_object(
    'matchesPlayed', 0,
    'wins', 0,
    'losses', 0,
    'draws', 0,
    'goalsScored', 0,
    'assists', 0,
    'mvpCount', 0,
    'fairPlayScore', 0,
    'tournamentsWon', 0,
    'cashPrizesTotal', 0
  ),
  '',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  is_premium = EXCLUDED.is_premium,
  updated_at = NOW();

-- Vérification
SELECT 
  id,
  email,
  username,
  phone,
  role,
  is_verified,
  is_premium
FROM public.users
WHERE id = 'f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055';
