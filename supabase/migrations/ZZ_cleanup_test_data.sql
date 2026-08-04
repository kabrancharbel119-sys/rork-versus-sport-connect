-- ============================================
-- CLEANUP ALL TEST DATA
-- Removes all users, teams, matches, etc. created during E2E test runs
-- ============================================

-- Get all test user IDs (emails matching test_*@vstest.com or usernames matching user_%)
CREATE TEMP TABLE test_user_ids AS
SELECT id FROM users
WHERE email LIKE 'test_%@vstest.com'
   OR username LIKE 'user_%';

-- Delete child records that reference test users
DELETE FROM match_events WHERE created_by IN (SELECT id FROM test_user_ids);
DELETE FROM match_events WHERE player_id IN (SELECT id FROM test_user_ids);
DELETE FROM live_match_stats WHERE match_id IN (
  SELECT id FROM matches WHERE created_by IN (SELECT id FROM test_user_ids)
);
DELETE FROM player_rankings WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM team_rankings WHERE team_id IN (
  SELECT id FROM teams WHERE captain_id IN (SELECT id FROM test_user_ids)
);
DELETE FROM notifications WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM follows WHERE follower_id IN (SELECT id FROM test_user_ids)
                        OR following_id IN (SELECT id FROM test_user_ids);
DELETE FROM chat_messages WHERE sender_id IN (SELECT id FROM test_user_ids);
DELETE FROM chat_requests WHERE requester_id IN (SELECT id FROM test_user_ids)
                             OR recipient_id IN (SELECT id FROM test_user_ids);
DELETE FROM chat_rooms WHERE id IN (
  SELECT room_id FROM chat_messages WHERE sender_id IN (SELECT id FROM test_user_ids)
);
DELETE FROM post_likes WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM post_comments WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM posts WHERE author_id IN (SELECT id FROM test_user_ids);
DELETE FROM team_post_likes WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM team_post_comments WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM team_posts WHERE author_id IN (SELECT id FROM test_user_ids);
DELETE FROM team_photos WHERE team_id IN (
  SELECT id FROM teams WHERE captain_id IN (SELECT id FROM test_user_ids)
);
DELETE FROM team_cm_assignments WHERE team_id IN (
  SELECT id FROM teams WHERE captain_id IN (SELECT id FROM test_user_ids)
);
DELETE FROM team_dissolution_requests WHERE requester_id IN (SELECT id FROM test_user_ids);
DELETE FROM tickets WHERE buyer_id IN (SELECT id FROM test_user_ids);
DELETE FROM ticket_types WHERE created_by IN (SELECT id FROM test_user_ids)
                            OR (event_type = 'match' AND event_id IN (
                              SELECT id FROM matches WHERE created_by IN (SELECT id FROM test_user_ids)
                            ))
                            OR (event_type = 'tournament' AND event_id IN (
                              SELECT id FROM tournaments WHERE created_by IN (SELECT id FROM test_user_ids)
                            ));
DELETE FROM bookings WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM invoices WHERE payer_id IN (SELECT id FROM test_user_ids);
DELETE FROM tournament_disputes WHERE reported_by IN (SELECT id FROM test_user_ids);
DELETE FROM tournament_payout_requests WHERE organizer_id IN (SELECT id FROM test_user_ids);
DELETE FROM tournament_funds_ledger WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE created_by IN (SELECT id FROM test_user_ids)
);
DELETE FROM tournament_payments WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE created_by IN (SELECT id FROM test_user_ids)
);
DELETE FROM tournament_teams WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE created_by IN (SELECT id FROM test_user_ids)
);
DELETE FROM post_reports WHERE reporter_id IN (SELECT id FROM test_user_ids);
DELETE FROM user_trophies WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM trophies WHERE user_id IN (SELECT id FROM test_user_ids);
DELETE FROM matches WHERE created_by IN (SELECT id FROM test_user_ids);
DELETE FROM tournaments WHERE created_by IN (SELECT id FROM test_user_ids);
DELETE FROM teams WHERE captain_id IN (SELECT id FROM test_user_ids);
DELETE FROM venues WHERE owner_id IN (SELECT id FROM test_user_ids);

-- Finally delete the test users from the users table
DELETE FROM users WHERE id IN (SELECT id FROM test_user_ids);

-- Delete test auth users (emails matching test_*@vstest.com)
-- Note: This must be done via Supabase Admin API, not SQL directly.
-- The SQL above removes the profile rows. Auth users can be cleaned via:
-- Dashboard > Authentication > Users > filter by @vstest.com > delete all

-- Drop the temp table
DROP TABLE test_user_ids;

-- Verify cleanup
SELECT 'Remaining test users: ' || COUNT(*)::TEXT FROM users WHERE email LIKE 'test_%@vstest.com';
SELECT 'Remaining test matches: ' || COUNT(*)::TEXT FROM matches WHERE title = 'Test Match';
SELECT 'Remaining test teams: ' || COUNT(*)::TEXT FROM teams WHERE name LIKE 'Team %' AND name NOT IN ('Team A','Team B','Team C','Team D');
