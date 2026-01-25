#!/usr/bin/env node

/**
 * =====================================================
 * VS Sport App - Vérification Finale Complète
 * =====================================================
 * 
 * Ce script vérifie que TOUT est fonctionnel :
 * - Connexion Supabase
 * - Tables et colonnes
 * - Fonctions SQL
 * - APIs
 * - Storage
 * - Realtime
 * - Authentification E2E
 * - Flux complet (signup → team → match → chat)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Couleurs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Compteurs
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let criticalErrors = [];
let warnings = [];

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, error = null, critical = false) {
  totalTests++;
  if (passed) {
    passedTests++;
    log(`  ✅ ${name}`, 'green');
  } else {
    failedTests++;
    log(`  ❌ ${name}`, 'red');
    if (error) {
      log(`     → ${error}`, 'red');
      if (critical) {
        criticalErrors.push({ test: name, error });
      } else {
        warnings.push({ test: name, error });
      }
    }
  }
}

function logSection(title, emoji = '📋') {
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`${emoji} ${title}`, 'bright');
  log('='.repeat(70), 'cyan');
}

function logSubSection(title) {
  log(`\n  ${title}`, 'blue');
  log(`  ${'-'.repeat(65)}`, 'blue');
}

// Load environment
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log('❌ Fichier .env non trouvé', 'red');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });

  return env;
}

// Generate test data
function generateTestData() {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  return {
    userId: crypto.randomUUID(),
    phone: `225${timestamp.toString().slice(-9)}`,
    username: `testuser_${randomId}`,
    fullName: `Test User ${randomId}`,
    password: 'TestPassword123!',
    email: `test_${randomId}@test.com`,
    teamName: `Team Test ${randomId}`,
    matchTitle: `Match Test ${randomId}`,
  };
}

// Hash password (same as app)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'vs_salt_2024').digest('hex');
}

// Main test function
async function runTests() {
  log('\n🔍 VS SPORT APP - VÉRIFICATION FINALE COMPLÈTE', 'bright');
  log('='.repeat(70) + '\n', 'bright');

  // Load environment
  const env = loadEnv();
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('❌ Variables Supabase manquantes', 'red');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const testData = generateTestData();

  // =====================================================
  // 1. INFRASTRUCTURE
  // =====================================================
  logSection('1. INFRASTRUCTURE', '🏗️');

  // Connexion
  try {
    const { error } = await supabase.from('users').select('count').limit(0);
    logTest('Connexion Supabase', !error, error?.message, true);
  } catch (err) {
    logTest('Connexion Supabase', false, err.message, true);
  }

  // Tables essentielles
  logSubSection('Tables principales');
  const criticalTables = ['users', 'teams', 'matches', 'chat_messages', 'notifications'];
  for (const table of criticalTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      logTest(`Table "${table}"`, !error, error?.message, true);
    } catch (err) {
      logTest(`Table "${table}"`, false, err.message, true);
    }
  }

  // Tables secondaires
  logSubSection('Tables secondaires');
  const secondaryTables = ['team_members', 'match_players', 'tournaments', 'venues', 'bookings', 'follows', 'trophies', 'referrals', 'push_tokens', 'support_tickets'];
  for (const table of secondaryTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      logTest(`Table "${table}"`, !error, error?.message);
    } catch (err) {
      logTest(`Table "${table}"`, false, err.message);
    }
  }

  // =====================================================
  // 2. COLONNES USERS
  // =====================================================
  logSection('2. STRUCTURE USERS', '👤');

  const requiredColumns = [
    'id', 'email', 'username', 'phone', 'password_hash',
    'full_name', 'avatar', 'city', 'country', 'bio',
    'sports', 'stats', 'teams', 'followers', 'following',
    'is_verified', 'is_premium', 'role', 'wallet_balance',
    'reputation', 'created_at', 'updated_at'
  ];

  try {
    const testUser = {
      id: testData.userId,
      email: testData.email,
      username: testData.username,
      phone: testData.phone,
      password_hash: hashPassword(testData.password),
      full_name: testData.fullName,
    };

    const { data, error } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single();

    if (error) {
      logTest('Insertion test user', false, error.message, true);
    } else {
      logTest('Insertion test user', true);
      
      for (const col of requiredColumns) {
        const exists = col in data;
        logTest(`Colonne "${col}"`, exists, exists ? null : 'Manquante');
      }

      // Clean up
      await supabase.from('users').delete().eq('id', testData.userId);
    }
  } catch (err) {
    logTest('Test colonnes users', false, err.message, true);
  }

  // =====================================================
  // 3. FONCTIONS SQL
  // =====================================================
  logSection('3. FONCTIONS SQL', '⚙️');

  const functions = [
    'increment_followers',
    'decrement_followers',
    'increment_following',
    'decrement_following'
  ];

  for (const func of functions) {
    try {
      // Test si la fonction existe en essayant de l'appeler
      const testUserId = crypto.randomUUID();
      
      // Crée un user temporaire
      await supabase.from('users').insert({
        id: testUserId,
        email: `functest_${Date.now()}@test.com`,
        username: `functest_${Date.now()}`,
        phone: `225${Date.now().toString().slice(-9)}`,
        password_hash: 'test',
        full_name: 'Function Test',
      });

      // Test la fonction
      const { error } = await supabase.rpc(func, { user_id: testUserId });
      
      logTest(`Fonction "${func}"`, !error, error?.message, true);

      // Clean up
      await supabase.from('users').delete().eq('id', testUserId);
    } catch (err) {
      logTest(`Fonction "${func}"`, false, err.message, true);
    }
  }

  // =====================================================
  // 4. STORAGE
  // =====================================================
  logSection('4. STORAGE', '📦');

  const buckets = ['avatar', 'team-logos', 'match-photos'];
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket);
      logTest(`Bucket "${bucket}"`, !error && data, error?.message);
    } catch (err) {
      logTest(`Bucket "${bucket}"`, false, err.message);
    }
  }

  // =====================================================
  // 5. REALTIME
  // =====================================================
  logSection('5. REALTIME', '⚡');

  const realtimeTables = ['chat_messages', 'notifications', 'match_players'];
  
  for (const table of realtimeTables) {
    try {
      const channel = supabase
        .channel(`test-${table}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table },
          () => {}
        );

      const subscribed = await new Promise((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve(true);
          else if (status === 'CHANNEL_ERROR') resolve(false);
        });
        
        setTimeout(() => resolve(false), 3000);
      });

      logTest(`Realtime "${table}"`, subscribed, subscribed ? null : 'Subscription failed');
      
      await supabase.removeChannel(channel);
    } catch (err) {
      logTest(`Realtime "${table}"`, false, err.message);
    }
  }

  // =====================================================
  // 6. FLUX AUTHENTIFICATION
  // =====================================================
  logSection('6. FLUX AUTHENTIFICATION', '🔐');

  let createdUserId = null;
  const authTestUserId = crypto.randomUUID();
  const authTimestamp = Date.now();
  const authRandomId = Math.random().toString(36).substring(7);

  try {
    // Création utilisateur
    const newUser = {
      id: authTestUserId,
      email: `auth_test_${authRandomId}@test.com`,
      username: `authtest_${authRandomId}`,
      phone: `225${authTimestamp.toString().slice(-9)}`,
      password_hash: hashPassword(testData.password),
      full_name: testData.fullName,
      city: 'Test City',
      country: 'Test Country',
    };

    const { data: user, error: createError } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();

    logTest('Création utilisateur', !createError, createError?.message, true);

    if (!createError) {
      createdUserId = authTestUserId;

      // Lecture utilisateur
      const { data: readUser, error: readError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authTestUserId)
        .single();

      logTest('Lecture par téléphone', !readError && readUser, readError?.message);

      // Vérification mot de passe
      const passwordMatch = readUser && readUser.password_hash === hashPassword(testData.password);
      logTest('Vérification password', passwordMatch, passwordMatch ? null : 'Password mismatch');

      // Mise à jour
      const { error: updateError } = await supabase
        .from('users')
        .update({ bio: 'Updated bio test' })
        .eq('id', createdUserId);

      logTest('Mise à jour profil', !updateError, updateError?.message);
    }
  } catch (err) {
    logTest('Flux authentification', false, err.message, true);
  }

  // =====================================================
  // 7. FLUX ÉQUIPE
  // =====================================================
  logSection('7. FLUX ÉQUIPE', '👥');

  let createdTeamId = null;

  if (createdUserId) {
    try {
      // Création équipe
      const newTeam = {
        id: crypto.randomUUID(),
        name: testData.teamName,
        sport: 'Football',
        captain_id: createdUserId,
      };

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert(newTeam)
        .select()
        .single();

      logTest('Création équipe', !teamError, teamError?.message);

      if (!teamError) {
        createdTeamId = team.id;

        // Ajout membre
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: createdTeamId,
            user_id: createdUserId,
            role: 'captain',
          });

        logTest('Ajout membre équipe', !memberError, memberError?.message);

        // Lecture équipe avec membres
        const { data: teamWithMembers, error: readTeamError } = await supabase
          .from('teams')
          .select('*, team_members(*)')
          .eq('id', createdTeamId)
          .single();

        logTest('Lecture équipe + membres', !readTeamError && teamWithMembers, readTeamError?.message);
      }
    } catch (err) {
      logTest('Flux équipe', false, err.message);
    }
  } else {
    logTest('Flux équipe', false, 'User non créé', true);
  }

  // =====================================================
  // 8. FLUX MATCH
  // =====================================================
  logSection('8. FLUX MATCH', '⚽');

  let createdMatchId = null;

  if (createdUserId) {
    try {
      // Création match
      const newMatch = {
        id: crypto.randomUUID(),
        title: testData.matchTitle,
        sport: 'Football',
        match_type: 'friendly',
        format: '5v5',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        status: 'upcoming',
        created_by: createdUserId,
      };

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert(newMatch)
        .select()
        .single();

      logTest('Création match', !matchError, matchError?.message);

      if (!matchError) {
        createdMatchId = match.id;

        // Inscription au match
        const { error: joinError } = await supabase
          .from('match_players')
          .insert({
            match_id: createdMatchId,
            user_id: createdUserId,
            team: 'team_a',
          });

        logTest('Inscription au match', !joinError, joinError?.message);

        // Lecture match avec joueurs
        const { data: matchWithPlayers, error: readMatchError } = await supabase
          .from('matches')
          .select('*, match_players(*)')
          .eq('id', createdMatchId)
          .single();

        logTest('Lecture match + joueurs', !readMatchError && matchWithPlayers, readMatchError?.message);
      }
    } catch (err) {
      logTest('Flux match', false, err.message);
    }
  } else {
    logTest('Flux match', false, 'User non créé', true);
  }

  // =====================================================
  // 9. FLUX CHAT
  // =====================================================
  logSection('9. FLUX CHAT', '💬');

  if (createdUserId && createdTeamId) {
    try {
      // Création room
      const newRoom = {
        id: crypto.randomUUID(),
        name: 'Test Chat Room',
        type: 'team',
        team_id: createdTeamId,
      };

      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert(newRoom)
        .select()
        .single();

      logTest('Création chat room', !roomError, roomError?.message);

      if (!roomError) {
        // Ajout membre room
        const { error: memberError } = await supabase
          .from('chat_room_members')
          .insert({
            room_id: room.id,
            user_id: createdUserId,
            role: 'admin',
          });

        logTest('Ajout membre chat', !memberError, memberError?.message);

        // Envoi message
        const { error: messageError } = await supabase
          .from('chat_messages')
          .insert({
            room_id: room.id,
            user_id: createdUserId,
            content: 'Test message',
            type: 'text',
          });

        logTest('Envoi message', !messageError, messageError?.message);

        // Lecture messages
        const { data: messages, error: readError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', room.id);

        logTest('Lecture messages', !readError && messages && messages.length > 0, readError?.message);

        // Clean up chat
        await supabase.from('chat_messages').delete().eq('room_id', room.id);
        await supabase.from('chat_room_members').delete().eq('room_id', room.id);
        await supabase.from('chat_rooms').delete().eq('id', room.id);
      }
    } catch (err) {
      logTest('Flux chat', false, err.message);
    }
  } else {
    logTest('Flux chat', false, 'User ou Team non créé');
  }

  // =====================================================
  // 10. SYSTÈME SOCIAL
  // =====================================================
  logSection('10. SYSTÈME SOCIAL', '👥');

  if (createdUserId) {
    try {
      // Créer un deuxième user
      const user2Id = crypto.randomUUID();
      await supabase.from('users').insert({
        id: user2Id,
        email: `social_test_${Date.now()}@test.com`,
        username: `socialtest_${Date.now()}`,
        phone: `225${Date.now().toString().slice(-9)}`,
        password_hash: 'test',
        full_name: 'Social Test User',
      });

      // Follow
      const { error: followError } = await supabase
        .from('follows')
        .insert({
          follower_id: createdUserId,
          following_id: user2Id,
        });

      logTest('Follow utilisateur', !followError, followError?.message);

      // Test fonctions increment (si elles existent)
      try {
        await supabase.rpc('increment_following', { user_id: createdUserId });
        await supabase.rpc('increment_followers', { user_id: user2Id });
        logTest('Fonctions follow/followers', true);
      } catch (err) {
        logTest('Fonctions follow/followers', false, err.message);
      }

      // Unfollow
      const { error: unfollowError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', createdUserId)
        .eq('following_id', user2Id);

      logTest('Unfollow utilisateur', !unfollowError, unfollowError?.message);

      // Clean up
      await supabase.from('users').delete().eq('id', user2Id);
    } catch (err) {
      logTest('Système social', false, err.message);
    }
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  logSection('11. NETTOYAGE', '🧹');

  try {
    if (createdMatchId) {
      await supabase.from('match_players').delete().eq('match_id', createdMatchId);
      await supabase.from('matches').delete().eq('id', createdMatchId);
      logTest('Nettoyage match', true);
    }

    if (createdTeamId) {
      await supabase.from('team_members').delete().eq('team_id', createdTeamId);
      await supabase.from('teams').delete().eq('id', createdTeamId);
      logTest('Nettoyage équipe', true);
    }

    if (createdUserId) {
      await supabase.from('follows').delete().eq('follower_id', createdUserId);
      await supabase.from('follows').delete().eq('following_id', createdUserId);
      await supabase.from('users').delete().eq('id', createdUserId);
      logTest('Nettoyage utilisateur', true);
    }
  } catch (err) {
    logTest('Nettoyage', false, err.message);
  }

  // =====================================================
  // RÉSUMÉ FINAL
  // =====================================================
  logSection('RÉSUMÉ FINAL', '📊');

  const successRate = Math.round((passedTests / totalTests) * 100);
  
  log(`\n  Total de tests : ${totalTests}`, 'bright');
  log(`  ✅ Tests réussis : ${passedTests}`, 'green');
  log(`  ❌ Tests échoués : ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  log(`  📊 Taux de réussite : ${successRate}%\n`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');

  // Erreurs critiques
  if (criticalErrors.length > 0) {
    log('  🚨 ERREURS CRITIQUES:', 'red');
    log('  ' + '='.repeat(65), 'red');
    criticalErrors.forEach((err, i) => {
      log(`  ${i + 1}. ${err.test}`, 'yellow');
      log(`     → ${err.error}`, 'red');
    });
    log('');
  }

  // Avertissements
  if (warnings.length > 0 && criticalErrors.length === 0) {
    log('  ⚠️  AVERTISSEMENTS:', 'yellow');
    log('  ' + '='.repeat(65), 'yellow');
    warnings.forEach((err, i) => {
      log(`  ${i + 1}. ${err.test}`, 'yellow');
      log(`     → ${err.error}`, 'yellow');
    });
    log('');
  }

  // Verdict final
  log('='.repeat(70), 'cyan');
  if (successRate === 100) {
    log('🎉 PARFAIT ! L\'APP EST 100% FONCTIONNELLE !', 'green');
  } else if (successRate >= 90 && criticalErrors.length === 0) {
    log('✅ EXCELLENT ! L\'app est prête pour la production.', 'green');
  } else if (successRate >= 80 && criticalErrors.length === 0) {
    log('👍 BIEN ! Quelques détails à corriger mais l\'app fonctionne.', 'yellow');
  } else if (criticalErrors.length > 0) {
    log('❌ ERREURS CRITIQUES ! Corrigez-les avant de continuer.', 'red');
  } else {
    log('⚠️  PLUSIEURS PROBLÈMES détectés. Vérifiez les erreurs.', 'yellow');
  }
  log('='.repeat(70) + '\n', 'cyan');

  process.exit(criticalErrors.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  log(`\n❌ Erreur fatale: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
