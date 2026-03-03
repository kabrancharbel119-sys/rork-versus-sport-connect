-- ══════════════════════════════════════════════════════════════
-- CRÉER LE PROFIL ADMIN POUR LE COMPTE DASHBOARD
-- ══════════════════════════════════════════════════════════════
-- UUID du compte créé via Dashboard : 81d7aa73-2aa7-4b4e-bb72-c0fcae790f21
-- Email : kabrancharbel1@gmail.com
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.users (
  id,
  email,
  username,
  full_name,
  city,
  country,
  role,
  is_verified,
  is_premium,
  referral_code,
  stats,
  bio,
  reputation,
  wallet_balance,
  sports,
  teams,
  followers,
  following,
  created_at,
  updated_at
) VALUES (
  '81d7aa73-2aa7-4b4e-bb72-c0fcae790f21',
  'kabrancharbel1@gmail.com',
  'charbel_admin',
  'Charbel Kabran',
  'Abidjan',
  'Côte d''Ivoire',
  'admin',
  true,
  true,
  'VSADMIN2',
  jsonb_build_object(
    'matchesPlayed', 0,
    'wins', 0,
    'losses', 0,
    'draws', 0,
    'goalsScored', 0,
    'assists', 0,
    'mvpCount', 0,
    'fairPlayScore', 5,
    'tournamentsWon', 0,
    'cashPrizesTotal', 0
  ),
  '',
  5.0,
  0.00,
  '[]'::jsonb,
  ARRAY[]::text[],
  0,
  0,
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

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ══════════════════════════════════════════════════════════════

-- Vérifier le profil créé
SELECT 
  id,
  email,
  username,
  role,
  is_verified,
  is_premium,
  created_at
FROM public.users
WHERE id = '81d7aa73-2aa7-4b4e-bb72-c0fcae790f21';

-- Vérifier que les IDs correspondent entre auth.users et public.users
SELECT 
  CASE 
    WHEN a.id = p.id THEN '✅ IDs synchronisés - Login OK'
    ELSE '❌ IDs différents - Login échouera'
  END as status,
  a.id as auth_id,
  a.email as auth_email,
  p.id as public_id,
  p.email as public_email,
  p.role
FROM auth.users a
FULL OUTER JOIN public.users p ON a.id = p.id
WHERE a.email = 'kabrancharbel1@gmail.com' OR p.email = 'kabrancharbel1@gmail.com';
