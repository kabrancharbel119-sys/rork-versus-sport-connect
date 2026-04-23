-- Enable Realtime on venues table so clients get instant updates (new images, edits, etc.)
ALTER PUBLICATION supabase_realtime ADD TABLE venues;
