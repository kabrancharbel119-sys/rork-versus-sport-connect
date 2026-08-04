-- ============================================
-- FIX followers/following counts on users table
-- Recalculates from actual follows table
-- ============================================

-- Update followers count (how many people follow me)
UPDATE users u
SET followers = (
  SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id
)
WHERE EXISTS (SELECT 1 FROM follows f WHERE f.following_id = u.id)
   OR u.followers > 0;

-- Update following count (how many people I follow)
UPDATE users u
SET following = (
  SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id
)
WHERE EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id)
   OR u.following > 0;

-- Reset to 0 for users with no follows but non-zero counts
UPDATE users SET followers = 0 WHERE followers > 0 AND id NOT IN (SELECT DISTINCT following_id FROM follows);
UPDATE users SET following = 0 WHERE following > 0 AND id NOT IN (SELECT DISTINCT follower_id FROM follows);

-- Verify
SELECT 'Total follows: ' || COUNT(*)::TEXT FROM follows;
SELECT 'Users with followers > 0: ' || COUNT(*)::TEXT FROM users WHERE followers > 0;
SELECT 'Users with following > 0: ' || COUNT(*)::TEXT FROM users WHERE following > 0;
SELECT 'Max followers: ' || MAX(followers)::TEXT FROM users;
SELECT 'Max following: ' || MAX(following)::TEXT FROM users;
