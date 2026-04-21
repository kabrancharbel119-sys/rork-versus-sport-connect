-- Check all existing policies on notifications table
SELECT policyname, cmd, qual, with_check, roles
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;
