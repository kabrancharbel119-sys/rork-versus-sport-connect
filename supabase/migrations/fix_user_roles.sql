-- ============================================
-- FIX USER ROLES
-- Correction des rôles utilisateurs
-- ============================================

-- Afficher tous les utilisateurs et leurs rôles actuels
SELECT id, email, username, role, created_at
FROM users
ORDER BY created_at DESC;

-- Si vous voulez réinitialiser tous les utilisateurs normaux (sauf admins) au rôle 'user'
-- Décommentez les lignes suivantes après avoir vérifié les résultats ci-dessus :

-- UPDATE users 
-- SET role = 'user' 
-- WHERE role IS NULL 
--    OR (role != 'admin' AND role != 'venue_manager');

-- Pour mettre à jour un utilisateur spécifique en 'user' :
-- UPDATE users SET role = 'user' WHERE email = 'votre@email.com';

-- Pour mettre à jour un utilisateur spécifique en 'venue_manager' :
-- UPDATE users SET role = 'venue_manager' WHERE email = 'gestionnaire@email.com';

-- Vérification finale
SELECT 
  role,
  COUNT(*) as count
FROM users
GROUP BY role
ORDER BY role;
