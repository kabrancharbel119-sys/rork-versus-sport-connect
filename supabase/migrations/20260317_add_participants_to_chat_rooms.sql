-- Add participants column to chat_rooms table
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participants ON chat_rooms USING gin(participants);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
