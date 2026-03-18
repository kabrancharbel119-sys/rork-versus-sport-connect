-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can view their chat rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Users can create chat rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Users can update their chat rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Users can delete their chat rooms" ON chat_rooms;

-- Enable RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all chat rooms (filtering by participants is done in app logic)
CREATE POLICY "Authenticated users can view chat rooms"
ON chat_rooms FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create chat rooms
CREATE POLICY "Authenticated users can create chat rooms"
ON chat_rooms FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update chat rooms
CREATE POLICY "Authenticated users can update chat rooms"
ON chat_rooms FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete chat rooms
CREATE POLICY "Authenticated users can delete chat rooms"
ON chat_rooms FOR DELETE
TO authenticated
USING (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
