-- Add read_by column to chat_messages table
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_read_by ON chat_messages USING gin(read_by);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
