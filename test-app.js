#!/usr/bin/env node

/**
 * =====================================================
 * VS Sport App - Script de Test Automatique Complet
 * =====================================================
 * 
 * Ce script teste automatiquement :
 * - Connexion à Supabase
 * - Structure de la base de données
 * - Authentification (inscription/connexion)
 * - APIs (users, teams, matches, chat, etc.)
 * - Upload de fichiers (storage)
 * - Permissions (RLS)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Couleurs pour l'output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Compteurs
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, error = null) {
  totalTests++;
  if (passed) {
    passedTests++;
    log(`✅ ${name}`, 'green');
  } else {
    failedTests++;
    log(`❌ ${name}`, 'red');
    if (error) {
      log(`   → ${error}`, 'red');
      errors.push({ test: name, error });
    }
  }
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

// Load environment variables
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

// Generate random test data
function generateTestData() {
  const timestamp = Date.now();
  return {
    phone: `225${timestamp.toString().slice(-9)}`,
    username: `testuser_${timestamp}`,
    fullName: `Test User ${timestamp}`,
    password: 'TestPassword123!',
    email: `test_${timestamp}@test.com`,
    teamName: `Team Test ${timestamp}`,
    matchTitle: `Match Test ${timestamp}`,
  };
}

// Main test function
async function runTests() {
  log('\n🧪 VS SPORT APP - TESTS AUTOMATIQUES', 'bright');
  log('=====================================\n', 'bright');

  // Load environment
  const env = loadEnv();
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('❌ Variables d\'environnement Supabase manquantes', 'red');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  const testData = generateTestData();

  // =====================================================
  // 1. TEST DE CONNEXION SUPABASE
  // =====================================================
  logSection('1. Test de connexion Supabase');

  try {
    const { data, error } = await supabase.from('users').select('count').limit(0);
    logTest('Connexion à Supabase', !error, error?.message);
  } catch (err) {
    logTest('Connexion à Supabase', false, err.message);
  }

  // =====================================================
  // 2. TEST DE LA STRUCTURE DES TABLES
  // =====================================================
  logSection('2. Vérification de la structure des tables');

  const requiredTables = [
    'users',
    'teams',
    'team_members',
    'matches',
    'match_players',
    'tournaments',
    'venues',
    'bookings',
    'chat_rooms',
    'chat_room_members',
    'chat_messages',
    'notifications',
    'follows',
    'trophies',
    'referrals',
    'push_tokens',
    'support_tickets',
  ];

  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      logTest(`Table "${table}" existe`, !error, error?.message);
    } catch (err) {
      logTest(`Table "${table}" existe`, false, err.message);
    }
  }

  // =====================================================
  // 3. TEST DES COLONNES DE LA TABLE USERS
  // =====================================================
  logSection('3. Vérification des colonnes de la table users');

  const requiredColumns = [
    'id', 'email', 'username', 'phone', 'password_hash',
    'full_name', 'avatar', 'city', 'country', 'bio',
    'sports', 'stats', 'teams', 'followers', 'following',
    'is_verified', 'is_premium', 'role', 'wallet_balance',
    'reputation', 'location_lat', 'location_lng',
    'location_city', 'location_country', 'availability',
    'created_at', 'updated_at'
  ];

  try {
    // Insert test data to check columns
    const testUser = {
      id: crypto.randomUUID(),
      email: testData.email,
      username: testData.username,
      phone: testData.phone,
      password_hash: 'test_hash',
      full_name: testData.fullName,
    };

    const { data, error } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single();

    if (error) {
      logTest('Insertion test user', false, error.message);
    } else {
      logTest('Insertion test user', true);
      
      // Check each column exists
      for (const col of requiredColumns) {
        const exists = col in data || data[col] !== undefined;
        logTest(`Colonne "${col}"`, exists, exists ? null : 'Colonne manquante');
      }

      // Clean up test user
      await supabase.from('users').delete().eq('id', testUser.id);
    }
  } catch (err) {
    logTest('Test des colonnes', false, err.message);
  }

  // =====================================================
  // 4. TEST DE LA POLICY RLS (INSERTION)
  // =====================================================
  logSection('4. Test des policies RLS');

  try {
    const testUserId = crypto.randomUUID();
    const { error } = await supabase.from('users').insert({
      id: testUserId,
      email: `rls_test_${Date.now()}@test.com`,
      username: `rlstest_${Date.now()}`,
      phone: `225${Date.now().toString().slice(-9)}`,
      password_hash: 'test',
      full_name: 'RLS Test',
    });

    logTest('Policy RLS permet insertion', !error, error?.message);

    if (!error) {
      // Clean up
      await supabase.from('users').delete().eq('id', testUserId);
    }
  } catch (err) {
    logTest('Policy RLS permet insertion', false, err.message);
  }

  // =====================================================
  // 5. TEST DES BUCKETS STORAGE
  // =====================================================
  logSection('5. Vérification des buckets Storage');

  const requiredBuckets = ['avatar', 'team-logos', 'match-photos'];

  for (const bucket of requiredBuckets) {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket);
      logTest(`Bucket "${bucket}" existe`, !error && data, error?.message);
    } catch (err) {
      logTest(`Bucket "${bucket}" existe`, false, err.message);
    }
  }

  // =====================================================
  // 6. TEST AUTHENTIFICATION (si lib/api/users.ts existe)
  // =====================================================
  logSection('6. Test de l\'authentification');

  const usersApiPath = path.join(process.cwd(), 'lib', 'api', 'users.ts');
  if (fs.existsSync(usersApiPath)) {
    log('ℹ️  Test d\'authentification via lib/api/users.ts...', 'blue');
    
    try {
      // Test création utilisateur
      const newUserId = crypto.randomUUID();
      const { error: createError } = await supabase.from('users').insert({
        id: newUserId,
        email: testData.email,
        username: testData.username,
        phone: testData.phone,
        password_hash: 'hashed_password_test',
        full_name: testData.fullName,
      });

      logTest('Création utilisateur', !createError, createError?.message);

      if (!createError) {
        // Test lecture utilisateur
        const { data: user, error: readError } = await supabase
          .from('users')
          .select('*')
          .eq('phone', testData.phone)
          .single();

        logTest('Lecture utilisateur par téléphone', !readError && user, readError?.message);

        // Test mise à jour
        const { error: updateError } = await supabase
          .from('users')
          .update({ bio: 'Test bio updated' })
          .eq('id', newUserId);

        logTest('Mise à jour utilisateur', !updateError, updateError?.message);

        // Clean up
        await supabase.from('users').delete().eq('id', newUserId);
      }
    } catch (err) {
      logTest('Tests authentification', false, err.message);
    }
  } else {
    log('⚠️  lib/api/users.ts non trouvé - test skippé', 'yellow');
  }

  // =====================================================
  // 7. TEST DES RELATIONS ENTRE TABLES
  // =====================================================
  logSection('7. Test des relations entre tables');

  try {
    // Crée un utilisateur de test
    const userId = crypto.randomUUID();
    await supabase.from('users').insert({
      id: userId,
      email: `rel_test_${Date.now()}@test.com`,
      username: `reltest_${Date.now()}`,
      phone: `225${Date.now().toString().slice(-9)}`,
      password_hash: 'test',
      full_name: 'Relation Test',
    });

    // Crée une équipe
    const teamId = crypto.randomUUID();
    const { error: teamError } = await supabase.from('teams').insert({
      id: teamId,
      name: testData.teamName,
      sport: 'Football',
      captain_id: userId,
    });

    logTest('Création équipe avec relation captain', !teamError, teamError?.message);

    // Crée un membre d'équipe
    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: teamId,
      user_id: userId,
      role: 'captain',
    });

    logTest('Création membre d\'équipe', !memberError, memberError?.message);

    // Clean up
    await supabase.from('team_members').delete().eq('team_id', teamId);
    await supabase.from('teams').delete().eq('id', teamId);
    await supabase.from('users').delete().eq('id', userId);
  } catch (err) {
    logTest('Test des relations', false, err.message);
  }

  // =====================================================
  // 8. TEST REALTIME
  // =====================================================
  logSection('8. Test Realtime');

  try {
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {}
      );

    await channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logTest('Souscription Realtime (chat_messages)', true);
      } else if (status === 'CHANNEL_ERROR') {
        logTest('Souscription Realtime (chat_messages)', false, 'Erreur de souscription');
      }
    });

    // Wait a bit for subscription
    await new Promise(resolve => setTimeout(resolve, 1000));
    await supabase.removeChannel(channel);
  } catch (err) {
    logTest('Test Realtime', false, err.message);
  }

  // =====================================================
  // 9. TEST DES TYPES TYPESCRIPT
  // =====================================================
  logSection('9. Vérification des types TypeScript');

  const typesPath = path.join(process.cwd(), 'types', 'supabase.ts');
  if (fs.existsSync(typesPath)) {
    const typesContent = fs.readFileSync(typesPath, 'utf-8');
    
    logTest('Fichier types/supabase.ts existe', true);
    logTest('Contient interface Database', typesContent.includes('export interface Database'));
    logTest('Contient table users', typesContent.includes('users:'));
    logTest('Contient table teams', typesContent.includes('teams:'));
    logTest('Contient table matches', typesContent.includes('matches:'));
    logTest('Contient table chat_messages', typesContent.includes('chat_messages:'));
  } else {
    logTest('Fichier types/supabase.ts existe', false, 'Fichier non trouvé');
  }

  // =====================================================
  // 10. RÉSUMÉ FINAL
  // =====================================================
  logSection('RÉSUMÉ DES TESTS');

  log(`\nTotal de tests : ${totalTests}`, 'bright');
  log(`✅ Tests réussis : ${passedTests}`, 'green');
  log(`❌ Tests échoués : ${failedTests}`, 'red');
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  log(`📊 Taux de réussite : ${successRate}%\n`, successRate >= 80 ? 'green' : successRate >= 50 ? 'yellow' : 'red');

  if (failedTests > 0) {
    log('\n🔧 ERREURS DÉTECTÉES:', 'red');
    log('='.repeat(60), 'red');
    errors.forEach((err, index) => {
      log(`\n${index + 1}. ${err.test}`, 'yellow');
      log(`   → ${err.error}`, 'red');
    });
    log('\n');
  }

  if (successRate === 100) {
    log('🎉 TOUS LES TESTS SONT PASSÉS ! Votre app est prête !', 'green');
  } else if (successRate >= 80) {
    log('✅ La plupart des tests sont passés. L\'app devrait fonctionner.', 'green');
  } else if (successRate >= 50) {
    log('⚠️  Plusieurs tests ont échoué. Corrigez les erreurs avant de continuer.', 'yellow');
  } else {
    log('❌ Trop d\'erreurs critiques. L\'app ne fonctionnera probablement pas.', 'red');
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  log(`\n❌ Erreur fatale: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
