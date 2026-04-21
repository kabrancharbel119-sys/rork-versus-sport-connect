-- Check all existing policies on bookings table
SELECT policyname, cmd, qual, with_check, roles
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY cmd, policyname;
