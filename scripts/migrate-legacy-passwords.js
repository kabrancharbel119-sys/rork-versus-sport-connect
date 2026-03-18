#!/usr/bin/env node

/**
 * Script de migration des mots de passe legacy (SHA256) vers bcrypt
 * 
 * ATTENTION: Ce script doit être exécuté avec précaution en production
 * 
 * Usage:
 *   node scripts/migrate-legacy-passwords.js
 * 
 * Prérequis:
 *   - SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env
 *   - Accès à la base de données Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const hashSalt = 'vs_salt_2024';

function isLegacyHash(hash) {
  // Les hash bcrypt commencent par $2a$, $2b$, ou $2y$
  // Les hash SHA256 sont des hex de 64 caractères
  return hash && !hash.startsWith('$2') && hash.length === 64;
}

function hashPasswordLegacy(password) {
  return crypto.createHash('sha256').update(password + hashSalt).digest('hex');
}

async function migrateUser(user) {
  const { id, email, phone, password_hash } = user;
  
  if (!password_hash) {
    console.log(`⏭️  User ${email || phone} - Pas de password_hash, ignoré`);
    return { skipped: true };
  }
  
  if (!isLegacyHash(password_hash)) {
    console.log(`✅ User ${email || phone} - Déjà en bcrypt`);
    return { alreadyMigrated: true };
  }
  
  console.log(`🔄 User ${email || phone} - Migration en cours...`);
  
  // On ne peut pas récupérer le mot de passe original depuis le hash
  // Solution: Générer un mot de passe temporaire et forcer un reset
  
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const newHash = bcrypt.hashSync(tempPassword, 10);
  
  // Mettre à jour le hash
  const { error: updateError } = await supabase
    .from('users')
    .update({ 
      password_hash: newHash,
      // Optionnel: marquer que l'utilisateur doit reset son mot de passe
      // must_reset_password: true 
    })
    .eq('id', id);
  
  if (updateError) {
    console.error(`❌ User ${email || phone} - Erreur:`, updateError.message);
    return { error: updateError.message };
  }
  
  console.log(`✅ User ${email || phone} - Migré avec succès`);
  console.log(`   Mot de passe temporaire: ${tempPassword}`);
  console.log(`   ⚠️  L'utilisateur devra réinitialiser son mot de passe`);
  
  return { 
    migrated: true, 
    tempPassword,
    userId: id,
    contact: email || phone 
  };
}

async function main() {
  console.log('🚀 Démarrage de la migration des mots de passe legacy...\n');
  
  // Récupérer tous les utilisateurs avec un password_hash
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, phone, password_hash')
    .not('password_hash', 'is', null);
  
  if (error) {
    console.error('❌ Erreur lors de la récupération des utilisateurs:', error.message);
    process.exit(1);
  }
  
  console.log(`📊 ${users.length} utilisateurs trouvés\n`);
  
  const results = {
    total: users.length,
    migrated: [],
    alreadyMigrated: 0,
    skipped: 0,
    errors: [],
  };
  
  for (const user of users) {
    const result = await migrateUser(user);
    
    if (result.migrated) {
      results.migrated.push(result);
    } else if (result.alreadyMigrated) {
      results.alreadyMigrated++;
    } else if (result.skipped) {
      results.skipped++;
    } else if (result.error) {
      results.errors.push({ user, error: result.error });
    }
    
    // Pause pour éviter de surcharger la DB
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Résumé de la migration:');
  console.log(`   Total: ${results.total}`);
  console.log(`   ✅ Migrés: ${results.migrated.length}`);
  console.log(`   ✓  Déjà en bcrypt: ${results.alreadyMigrated}`);
  console.log(`   ⏭️  Ignorés: ${results.skipped}`);
  console.log(`   ❌ Erreurs: ${results.errors.length}`);
  
  if (results.migrated.length > 0) {
    console.log('\n⚠️  IMPORTANT: Mots de passe temporaires générés:');
    console.log('   Sauvegarder ces informations de manière sécurisée!\n');
    
    results.migrated.forEach(({ contact, tempPassword }) => {
      console.log(`   ${contact}: ${tempPassword}`);
    });
    
    console.log('\n📧 Actions recommandées:');
    console.log('   1. Envoyer un email de reset de mot de passe à chaque utilisateur migré');
    console.log('   2. Ou leur fournir le mot de passe temporaire de manière sécurisée');
    console.log('   3. Forcer le changement de mot de passe à la prochaine connexion');
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ Erreurs rencontrées:');
    results.errors.forEach(({ user, error }) => {
      console.log(`   ${user.email || user.phone}: ${error}`);
    });
  }
  
  console.log('\n✅ Migration terminée!');
}

main().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
