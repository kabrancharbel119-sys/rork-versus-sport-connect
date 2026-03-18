-- Drop ALL existing policies on chat_messages
DROP POLICY IF EXISTS "Users can view their chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can create chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can update chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can delete chat messages" ON chat_messages;

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all chat messages
CREATE POLICY "Authenticated users can view chat messages"
ON chat_messages FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create chat messages
CREATE POLICY "Authenticated users can create chat messages"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update chat messages
CREATE POLICY "Authenticated users can update chat messages"
ON chat_messages FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete chat messages
CREATE POLICY "Authenticated users can delete chat messages"
ON chat_messages FOR DELETE
TO authenticated
USING (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
