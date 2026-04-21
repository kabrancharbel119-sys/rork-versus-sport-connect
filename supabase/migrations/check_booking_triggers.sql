-- Check triggers on bookings table
SELECT trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'bookings';

-- Check if there's any function that auto-cancels bookings
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
  AND routine_definition ILIKE '%cancel%'
  AND routine_schema = 'public';
