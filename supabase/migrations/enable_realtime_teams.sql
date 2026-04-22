-- Enable Realtime on teams table so clients get instant updates (member removal, joins, etc.)
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
