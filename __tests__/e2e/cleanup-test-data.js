const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase test credentials in .env.test');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function cleanupTestData() {
  console.log('🧹 Starting test data cleanup...\n');

  // 1. Find test users by email pattern
  console.log('1. Finding test users...');
  const { data: testUsers, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email, username, phone, referral_code')
    .or('email.like.test_%@vstest.com,username.like.user_%')
    .limit(500);

  if (userError) {
    console.error('   ❌ Error fetching test users:', userError.message);
  } else {
    console.log(`   Found ${testUsers?.length || 0} test users`);
  }

  const testUserIds = (testUsers || []).map(u => u.id);
  const testUserEmails = (testUsers || []).map(u => u.email).filter(Boolean);

  // 2. Find test venues (name like 'Stadium %' or address like '%Test Street%')
  console.log('\n2. Finding test venues...');
  const { data: testVenues, error: venueError } = await supabaseAdmin
    .from('venues')
    .select('id, name, address')
    .or('name.like.Stadium %,address.like.%Test Street%')
    .limit(500);

  if (venueError) {
    console.error('   ❌ Error fetching test venues:', venueError.message);
  } else {
    console.log(`   Found ${testVenues?.length || 0} test venues`);
  }

  const testVenueIds = (testVenues || []).map(v => v.id);

  // 3. Find test matches (title like 'Test Match%')
  console.log('\n3. Finding test matches...');
  const { data: testMatches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, title')
    .ilike('title', 'Test Match%')
    .limit(500);

  if (matchError) {
    console.error('   ❌ Error fetching test matches:', matchError.message);
  } else {
    console.log(`   Found ${testMatches?.length || 0} test matches`);
  }

  const testMatchIds = (testMatches || []).map(m => m.id);

  // 4. Find test teams (name like 'Team % FC')
  console.log('\n4. Finding test teams...');
  const { data: testTeams, error: teamError } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .ilike('name', 'Team % FC')
    .limit(500);

  if (teamError) {
    console.error('   ❌ Error fetching test teams:', teamError.message);
  } else {
    console.log(`   Found ${testTeams?.length || 0} test teams`);
  }

  const testTeamIds = (testTeams || []).map(t => t.id);

  // 5. Find test tournaments (name like 'Tournament %')
  console.log('\n5. Finding test tournaments...');
  const { data: testTournaments, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id, name')
    .ilike('name', 'Tournament %')
    .limit(500);

  if (tournamentError) {
    console.error('   ❌ Error fetching test tournaments:', tournamentError.message);
  } else {
    console.log(`   Found ${testTournaments?.length || 0} test tournaments`);
  }

  const testTournamentIds = (testTournaments || []).map(t => t.id);

  // 6. Find test chat rooms (name like 'Test Room %')
  console.log('\n6. Finding test chat rooms...');
  const { data: testChatRooms, error: chatRoomError } = await supabaseAdmin
    .from('chat_rooms')
    .select('id, name')
    .ilike('name', 'Test Room %')
    .limit(500);

  if (chatRoomError) {
    console.error('   ⚠️ Error fetching test chat rooms:', chatRoomError.message);
  } else {
    console.log(`   Found ${testChatRooms?.length || 0} test chat rooms`);
  }

  const testChatRoomIds = (testChatRooms || []).map(r => r.id);

  // 7. Find test notifications by user_id
  console.log('\n7. Finding test notifications...');
  if (testUserIds.length > 0) {
    const { data: testNotifs, error: notifError } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .in('user_id', testUserIds)
      .limit(500);

    if (notifError) {
      console.error('   ⚠️ Error fetching test notifications:', notifError.message);
    } else {
      console.log(`   Found ${testNotifs?.length || 0} test notifications`);
    }
  } else {
    console.log('   Skipped (no test users)');
  }

  // 8. Find test user_trophies by user_id
  console.log('\n8. Finding test user_trophies...');
  if (testUserIds.length > 0) {
    const { data: testTrophies, error: trophyError } = await supabaseAdmin
      .from('user_trophies')
      .select('id')
      .in('user_id', testUserIds)
      .limit(500);

    if (trophyError) {
      console.error('   ⚠️ Error fetching test user_trophies:', trophyError.message);
    } else {
      console.log(`   Found ${testTrophies?.length || 0} test user_trophies`);
    }
  } else {
    console.log('   Skipped (no test users)');
  }

  // 9. Find test player_rankings by user_id
  console.log('\n9. Finding test player_rankings...');
  if (testUserIds.length > 0) {
    const { data: testRankings, error: rankingError } = await supabaseAdmin
      .from('player_rankings')
      .select('user_id')
      .in('user_id', testUserIds)
      .limit(500);

    if (rankingError) {
      console.error('   ⚠️ Error fetching test player_rankings:', rankingError.message);
    } else {
      console.log(`   Found ${testRankings?.length || 0} test player_rankings`);
    }
  } else {
    console.log('   Skipped (no test users)');
  }

  // ============================================
  // DELETION PHASE (reverse dependency order)
  // ============================================
  console.log('\n\n🗑️  Starting deletion phase...\n');

  // Delete match_events by match_id
  if (testMatchIds.length > 0) {
    console.log('Deleting match_events...');
    const { error } = await supabaseAdmin.from('match_events').delete().in('match_id', testMatchIds);
    if (error) console.error('   ❌', error.message);
    else console.log(`   ✅ Deleted match_events for ${testMatchIds.length} matches`);
  }

  // Delete live_match_stats by match_id
  if (testMatchIds.length > 0) {
    console.log('Deleting live_match_stats...');
    const { error } = await supabaseAdmin.from('live_match_stats').delete().in('match_id', testMatchIds);
    if (error) console.error('   ❌', error.message);
    else console.log(`   ✅ Deleted live_match_stats for ${testMatchIds.length} matches`);
  }

  // Delete chat_messages by room_id
  if (testChatRoomIds.length > 0) {
    console.log('Deleting chat_messages...');
    const { error } = await supabaseAdmin.from('chat_messages').delete().in('room_id', testChatRoomIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted chat_messages for ${testChatRoomIds.length} rooms`);
  }

  // Delete chat_rooms
  if (testChatRoomIds.length > 0) {
    console.log('Deleting chat_rooms...');
    const { error } = await supabaseAdmin.from('chat_rooms').delete().in('id', testChatRoomIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted ${testChatRoomIds.length} chat_rooms`);
  }

  // Delete notifications by user_id
  if (testUserIds.length > 0) {
    console.log('Deleting notifications...');
    const { error } = await supabaseAdmin.from('notifications').delete().in('user_id', testUserIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted notifications for ${testUserIds.length} users`);
  }

  // Delete user_trophies by user_id
  if (testUserIds.length > 0) {
    console.log('Deleting user_trophies...');
    const { error } = await supabaseAdmin.from('user_trophies').delete().in('user_id', testUserIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted user_trophies for ${testUserIds.length} users`);
  }

  // Delete player_rankings by user_id
  if (testUserIds.length > 0) {
    console.log('Deleting player_rankings...');
    const { error } = await supabaseAdmin.from('player_rankings').delete().in('user_id', testUserIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted player_rankings for ${testUserIds.length} users`);
  }

  // Delete team_rankings by team_id
  if (testTeamIds.length > 0) {
    console.log('Deleting team_rankings...');
    const { error } = await supabaseAdmin.from('team_rankings').delete().in('team_id', testTeamIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted team_rankings for ${testTeamIds.length} teams`);
  }

  // Delete matches
  if (testMatchIds.length > 0) {
    console.log('Deleting matches...');
    const { error } = await supabaseAdmin.from('matches').delete().in('id', testMatchIds);
    if (error) console.error('   ❌', error.message);
    else console.log(`   ✅ Deleted ${testMatchIds.length} matches`);
  }

  // Delete tournaments
  if (testTournamentIds.length > 0) {
    console.log('Deleting tournaments...');
    const { error } = await supabaseAdmin.from('tournaments').delete().in('id', testTournamentIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted ${testTournamentIds.length} tournaments`);
  }

  // Delete teams
  if (testTeamIds.length > 0) {
    console.log('Deleting teams...');
    const { error } = await supabaseAdmin.from('teams').delete().in('id', testTeamIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted ${testTeamIds.length} teams`);
  }

  // Delete venues
  if (testVenueIds.length > 0) {
    console.log('Deleting venues...');
    const { error } = await supabaseAdmin.from('venues').delete().in('id', testVenueIds);
    if (error) console.error('   ⚠️', error.message);
    else console.log(`   ✅ Deleted ${testVenueIds.length} venues`);
  }

  // Delete users (public.users table)
  if (testUserIds.length > 0) {
    console.log('Deleting users (public.users)...');
    const { error } = await supabaseAdmin.from('users').delete().in('id', testUserIds);
    if (error) console.error('   ❌', error.message);
    else console.log(`   ✅ Deleted ${testUserIds.length} users from public.users`);
  }

  // Delete auth users
  if (testUserEmails.length > 0) {
    console.log('Deleting auth users...');
    let authDeleted = 0;
    let authFailed = 0;
    for (const email of testUserEmails) {
      // Get auth user by email
      const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        console.error('   ⚠️ Could not list auth users:', listError.message);
        break;
      }
      const authUser = (authList?.users || []).find(u => u.email === email);
      if (authUser) {
        const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        if (delError) {
          console.error(`   ⚠️ Failed to delete auth user ${email}:`, delError.message);
          authFailed++;
        } else {
          authDeleted++;
        }
      }
    }
    console.log(`   ✅ Deleted ${authDeleted} auth users (${authFailed} failed)`);
  }

  console.log('\n\n✅ Cleanup complete!');
  console.log(`   Summary: ${testUserIds.length} users, ${testVenueIds.length} venues, ${testMatchIds.length} matches, ${testTeamIds.length} teams, ${testTournamentIds.length} tournaments, ${testChatRoomIds.length} chat rooms`);
}

cleanupTestData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
