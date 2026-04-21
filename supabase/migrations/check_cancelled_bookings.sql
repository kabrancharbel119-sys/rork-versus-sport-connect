-- Check if cancelled_at matches created_at (cancelled immediately) or later
SELECT 
  id,
  status,
  date,
  created_at,
  updated_at,
  ROUND(EXTRACT(EPOCH FROM (updated_at - created_at))) AS seconds_between_create_and_cancel,
  match_id
FROM bookings
WHERE status = 'cancelled'
ORDER BY created_at DESC
LIMIT 15;
