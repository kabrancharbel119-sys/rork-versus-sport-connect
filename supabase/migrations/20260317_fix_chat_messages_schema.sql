-- Check if user_id column exists and add it if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_id column to chat_messages';
    ELSE
        RAISE NOTICE 'user_id column already exists in chat_messages';
    END IF;
END $$;

-- Check if sender_id column exists and add it if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'sender_id'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN sender_id UUID REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added sender_id column to chat_messages';
    ELSE
        RAISE NOTICE 'sender_id column already exists in chat_messages';
    END IF;
END $$;

-- If both columns exist, we need to decide which one to use
-- Based on the code, it uses sender_id, so let's make user_id nullable or drop it
ALTER TABLE chat_messages ALTER COLUMN user_id DROP NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
