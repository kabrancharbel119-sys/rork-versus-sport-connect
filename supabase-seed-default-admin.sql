-- =============================================
-- COMPTE ADMIN PAR DÉFAUT - VS Sport
-- Exécuter une fois dans l’éditeur SQL Supabase (Dashboard > SQL Editor).
-- Ce compte a tous les droits (role=admin, is_verified, is_premium).
-- =============================================
-- Identifiants de connexion (ce compte doit avoir exactement) :
--   Téléphone : +1 438 508 9540
--   Mot de passe : Kouame2002$
--   Prénom : Charbel | Nom : Kabran
-- =============================================

-- 1) Créer ou mettre à jour l’admin (si username charbel_kabran existe déjà)
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
  referral_code,
  created_at
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'admin@versus.sport',
  'charbel_kabran',
  'Charbel Kabran',
  '+14385089540',
  '57419c9b799376183d5b033336ca39667b6c26e13c18700ff89b93bf3296a50d',
  'Abidjan',
  'Côte d''Ivoire',
  'admin',
  true,
  true,
  'VSADMIN',
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  role = 'admin',
  is_verified = true,
  is_premium = true,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  city = EXCLUDED.city,
  country = EXCLUDED.country;

-- 2) Garantir que le compte avec ce numéro a bien ces identifiants (nom, mdp, admin)
UPDATE users
SET
  full_name = 'Charbel Kabran',
  password_hash = '57419c9b799376183d5b033336ca39667b6c26e13c18700ff89b93bf3296a50d',
  role = 'admin',
  is_verified = true,
  is_premium = true
WHERE phone = '+14385089540';
