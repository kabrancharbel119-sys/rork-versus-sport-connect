-- =============================================
-- CLEANUP: Remove test/seed venues
-- Identifies and removes venues with test IDs (venue-1, venue-2, etc.)
-- and venues with no owner_id (seed data)
-- =============================================

-- 1. Show what will be deleted (preview)
SELECT id, name, address, owner_id, created_at
FROM venues
WHERE id::text LIKE 'venue-%'
   OR (owner_id IS NULL AND created_at < NOW() - INTERVAL '1 hour');

-- 2. Delete test seed venues (venue-1 through venue-12)
DELETE FROM venues
WHERE id::text LIKE 'venue-%';

-- 3. Delete orphan seed venues (no owner, created more than 1h ago)
-- This preserves recently created real venues that haven't been assigned an owner yet
DELETE FROM venues
WHERE owner_id IS NULL
  AND created_at < NOW() - INTERVAL '1 hour';

-- 4. Verify remaining venues
SELECT id, name, address, owner_id, is_active, created_at
FROM venues
ORDER BY created_at DESC;
