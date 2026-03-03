-- ══════════════════════════════════════════════════════════════
-- SOLUTION FINALE : Synchroniser auth.users avec public.users
-- ══════════════════════════════════════════════════════════════
-- Problème : auth.users a l'ID f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055
--            public.users a l'ID 145a8fc0-bcee-4548-ace4-050af3e8e7da
-- Solution : Supprimer le mauvais compte auth et en créer un avec le bon ID
-- ══════════════════════════════════════════════════════════════

-- 1. Supprimer le compte auth avec le mauvais ID
DELETE FROM auth.users WHERE id = 'f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055';
DELETE FROM auth.identities WHERE user_id = 'f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055';

-- 2. Créer le compte auth avec le BON ID (celui de public.users)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  role,
  aud,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '145a8fc0-bcee-4548-ace4-050af3e8e7da',  -- Le bon ID
  '00000000-0000-0000-0000-000000000000',
  'kabrancharbel@gmail.com',
  crypt('Kouame2002$', gen_salt('bf')),  -- Hash du mot de passe
  NOW(),
  jsonb_build_object(
    'email', 'kabrancharbel@gmail.com',
    'phone', '+14385089540',
    'username', 'charbel_kabran'
  ),
  'authenticated',
  'authenticated',
  NOW(),
  NOW(),
  '',
  ''
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = NOW();

-- 3. Créer l'identité email
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '145a8fc0-bcee-4548-ace4-050af3e8e7da',
  jsonb_build_object(
    'sub', '145a8fc0-bcee-4548-ace4-050af3e8e7da',
    'email', 'kabrancharbel@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider, user_id) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = NOW();

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ══════════════════════════════════════════════════════════════

-- Vérifier que les IDs correspondent
SELECT 
  'auth.users' as source,
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users
WHERE email = 'kabrancharbel@gmail.com'
UNION ALL
SELECT 
  'public.users' as source,
  id,
  email,
  is_verified as email_confirmed
FROM public.users
WHERE email = 'kabrancharbel@gmail.com';

-- Vérifier l'identité
SELECT 
  provider,
  user_id,
  identity_data->>'email' as email
FROM auth.identities
WHERE user_id = '145a8fc0-bcee-4548-ace4-050af3e8e7da';
