-- Drop any existing CHECK constraint on type column
ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_type_check;

-- Add proper CHECK constraint allowing all valid chat room types
ALTER TABLE chat_rooms 
ADD CONSTRAINT chat_rooms_type_check 
CHECK (type IN ('general', 'match', 'strategy', 'direct'));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
