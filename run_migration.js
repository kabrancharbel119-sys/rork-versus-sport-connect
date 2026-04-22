const https = require('https');

const SUPABASE_URL = 'vzycjpbrwwpvnypwzfrw.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6eWNqcGJyd3dwdm55cHd6ZnJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI0NjYxMCwiZXhwIjoyMDg0ODIyNjEwfQ.YnpnRLZSLFZHM40tuS9LFp7FNCktF6Y0WVwCxRlKnr8';

// Use the pg REST endpoint to run raw SQL via the supabase management API
const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'tournament_id') THEN
    ALTER TABLE bookings ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;
    RAISE NOTICE 'tournament_id added';
  ELSE
    RAISE NOTICE 'tournament_id already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN
    ALTER TABLE bookings ADD COLUMN total_amount INTEGER NOT NULL DEFAULT 0;
    RAISE NOTICE 'total_amount added';
  ELSE
    RAISE NOTICE 'total_amount already exists';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_tournament_id ON bookings(tournament_id);

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('venue_pending', 'registration', 'in_progress', 'completed', 'cancelled'));

SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' ORDER BY column_name;
`;

const body = JSON.stringify({ query: sql });

const options = {
  hostname: SUPABASE_URL,
  path: '/pg/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
