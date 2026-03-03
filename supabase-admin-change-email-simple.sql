-- ══════════════════════════════════════════════════════════════
-- CHANGER L'EMAIL DU COMPTE ADMIN EXISTANT
-- ══════════════════════════════════════════════════════════════
-- Simple : Juste changer l'email de +14385089540 à kabrancharbel@gmail.com
-- ══════════════════════════════════════════════════════════════

-- 1. Mettre à jour l'email dans public.users
UPDATE public.users
SET email = 'kabrancharbel@gmail.com'
WHERE phone = '+14385089540' OR username = 'charbel_kabran';

-- 2. Mettre à jour l'email dans auth.users (si le compte existe)
UPDATE auth.users
SET 
  email = 'kabrancharbel@gmail.com',
  email_confirmed_at = NOW(),
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{email}',
    '"kabrancharbel@gmail.com"'
  )
WHERE id IN (
  SELECT id FROM public.users WHERE phone = '+14385089540' OR username = 'charbel_kabran'
);

-- 3. Mettre à jour l'identité email
UPDATE auth.identities
SET identity_data = jsonb_set(
  identity_data,
  '{email}',
  '"kabrancharbel@gmail.com"'
)
WHERE user_id IN (
  SELECT id FROM public.users WHERE phone = '+14385089540' OR username = 'charbel_kabran'
)
AND provider = 'email';

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATION
-- ══════════════════════════════════════════════════════════════

SELECT 
  id,
  email,
  username,
  phone,
  role
FROM public.users
WHERE email = 'kabrancharbel@gmail.com' OR phone = '+14385089540';
