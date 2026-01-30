#!/usr/bin/env node

/**
 * =====================================================
 * VS Sport App - Vérification Pré-Déploiement
 * =====================================================
 * 
 * Ce script vérifie que TOUT est prêt pour déployer l'app
 * sur les stores iOS et Android.
 */

const fs = require('fs');
const path = require('path');

// Couleurs
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
let criticalIssues = 0;
let warnings = 0;
let passed = 0;

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title, emoji = '📋') {
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`${emoji} ${title}`, 'bright');
  log('='.repeat(70), 'cyan');
}

function checkPassed(message) {
  passed++;
  log(`  ✅ ${message}`, 'green');
}

function checkWarning(message, tip = null) {
  warnings++;
  log(`  ⚠️  ${message}`, 'yellow');
  if (tip) log(`     💡 ${tip}`, 'yellow');
}

function checkCritical(message, tip = null) {
  criticalIssues++;
  log(`  ❌ ${message}`, 'red');
  if (tip) log(`     💡 ${tip}`, 'red');
}

// Vérifications
function checkFileExists(filePath, criticalMessage, warningMessage = null) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    checkPassed(`${filePath} existe`);
    return true;
  } else {
    if (criticalMessage) {
      checkCritical(criticalMessage);
    } else if (warningMessage) {
      checkWarning(warningMessage);
    }
    return false;
  }
}

function checkAppJson() {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  
  if (!fs.existsSync(appJsonPath)) {
    checkCritical('app.json manquant', 'Créez app.json avec expo init');
    return;
  }

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  const expo = appJson.expo || {};

  // Version
  if (expo.version) {
    checkPassed(`Version définie: ${expo.version}`);
  } else {
    checkCritical('Version manquante dans app.json', 'Ajoutez "version": "1.0.0"');
  }

  // Name
  if (expo.name) {
    checkPassed(`Nom de l'app: ${expo.name}`);
  } else {
    checkCritical('Nom de l\'app manquant', 'Ajoutez "name" dans app.json');
  }

  // Slug
  if (expo.slug) {
    checkPassed(`Slug: ${expo.slug}`);
  } else {
    checkCritical('Slug manquant', 'Ajoutez "slug" dans app.json');
  }

  // Bundle Identifiers
  if (expo.ios?.bundleIdentifier) {
    if (expo.ios.bundleIdentifier.includes('com.yourcompany') || 
        expo.ios.bundleIdentifier.includes('com.example')) {
      checkCritical(
        `Bundle ID iOS générique: ${expo.ios.bundleIdentifier}`,
        'Changez-le en com.votrenom.vssport'
      );
    } else {
      checkPassed(`Bundle ID iOS: ${expo.ios.bundleIdentifier}`);
    }
  } else {
    checkCritical('Bundle ID iOS manquant', 'Ajoutez ios.bundleIdentifier');
  }

  if (expo.android?.package) {
    if (expo.android.package.includes('com.yourcompany') || 
        expo.android.package.includes('com.example')) {
      checkCritical(
        `Package Android générique: ${expo.android.package}`,
        'Changez-le en com.votrenom.vssport'
      );
    } else {
      checkPassed(`Package Android: ${expo.android.package}`);
    }
  } else {
    checkCritical('Package Android manquant', 'Ajoutez android.package');
  }

  // Build numbers
  if (expo.ios?.buildNumber) {
    checkPassed(`Build number iOS: ${expo.ios.buildNumber}`);
  } else {
    checkWarning('Build number iOS manquant', 'Ajoutez ios.buildNumber: "1"');
  }

  if (expo.android?.versionCode) {
    checkPassed(`Version code Android: ${expo.android.versionCode}`);
  } else {
    checkWarning('Version code Android manquant', 'Ajoutez android.versionCode: 1');
  }

  // Privacy & Terms (expo.extra pour stores, ou expo root)
  const privacyUrl = expo.extra?.privacyPolicyUrlWeb || expo.privacy;
  const termsUrl = expo.extra?.termsOfServiceUrlWeb || expo.termsOfServiceUrl;
  if (privacyUrl && typeof privacyUrl === 'string' && privacyUrl.startsWith('http')) {
    checkPassed(`Privacy URL: ${privacyUrl}`);
  } else {
    checkCritical(
      'Privacy URL manquant ou invalide',
      'Ajoutez extra.privacyPolicyUrlWeb (HTTPS) dans app.json'
    );
  }

  if (termsUrl && typeof termsUrl === 'string' && termsUrl.startsWith('http')) {
    checkPassed(`Terms URL: ${termsUrl}`);
  } else {
    checkCritical(
      'Terms URL manquant ou invalide',
      'Ajoutez extra.termsOfServiceUrlWeb (HTTPS) dans app.json'
    );
  }

  // Icons & Splash
  if (expo.icon) {
    const iconPath = path.join(process.cwd(), expo.icon);
    if (fs.existsSync(iconPath)) {
      const stats = fs.statSync(iconPath);
      if (stats.size > 1000) { // Plus de 1KB = probablement pas le placeholder
        checkPassed(`Icône définie: ${expo.icon}`);
      } else {
        checkWarning('Icône semble être un placeholder', 'Créez une vraie icône 1024x1024');
      }
    } else {
      checkCritical(`Icône non trouvée: ${expo.icon}`);
    }
  } else {
    checkCritical('Icône manquante', 'Ajoutez "icon" dans app.json');
  }

  if (expo.splash?.image) {
    const splashPath = path.join(process.cwd(), expo.splash.image);
    if (fs.existsSync(splashPath)) {
      checkPassed(`Splash screen défini: ${expo.splash.image}`);
    } else {
      checkWarning(`Splash screen non trouvé: ${expo.splash.image}`);
    }
  } else {
    checkWarning('Splash screen manquant', 'Ajoutez "splash.image" dans app.json');
  }

  // iOS Permissions
  if (expo.ios?.infoPlist) {
    const plist = expo.ios.infoPlist;
    const requiredPermissions = [
      'NSLocationWhenInUseUsageDescription',
      'NSCameraUsageDescription',
      'NSPhotoLibraryUsageDescription'
    ];

    requiredPermissions.forEach(perm => {
      if (plist[perm]) {
        checkPassed(`Permission iOS: ${perm}`);
      } else {
        checkWarning(
          `Permission iOS manquante: ${perm}`,
          'Ajoutez une description pour cette permission'
        );
      }
    });
  } else {
    checkWarning('Aucune permission iOS définie', 'Ajoutez ios.infoPlist');
  }

  // Android Permissions
  if (expo.android?.permissions && expo.android.permissions.length > 0) {
    checkPassed(`Permissions Android: ${expo.android.permissions.length} définies`);
  } else {
    checkWarning('Aucune permission Android définie', 'Ajoutez android.permissions');
  }
}

function checkEasJson() {
  const easJsonPath = path.join(process.cwd(), 'eas.json');
  
  if (!fs.existsSync(easJsonPath)) {
    checkCritical(
      'eas.json manquant',
      'Lancez: eas build:configure'
    );
    return;
  }

  checkPassed('eas.json existe');

  const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf-8'));

  // Production profile
  if (easJson.build?.production) {
    checkPassed('Profil de build "production" défini');
  } else {
    checkCritical(
      'Profil "production" manquant dans eas.json',
      'Ajoutez un profil build.production'
    );
  }

  // Submit profile
  if (easJson.submit?.production) {
    checkPassed('Profil de submit "production" défini');
  } else {
    checkWarning(
      'Profil submit "production" manquant',
      'Ajoutez submit.production pour automatiser les submissions'
    );
  }
}

function checkEnvFiles() {
  // .env
  if (fs.existsSync('.env')) {
    checkPassed('.env existe');
    
    const envContent = fs.readFileSync('.env', 'utf-8');
    
    // Vérifier les variables critiques
    const requiredVars = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY'
    ];

    requiredVars.forEach(varName => {
      if (envContent.includes(varName)) {
        checkPassed(`Variable ${varName} définie`);
      } else {
        checkCritical(
          `Variable ${varName} manquante dans .env`,
          'Ajoutez cette variable'
        );
      }
    });
  } else {
    checkWarning('.env manquant', 'Créez un .env avec vos variables');
  }

  // .env.example
  if (fs.existsSync('.env.example')) {
    checkPassed('.env.example existe (documentation)');
  } else {
    checkWarning(
      '.env.example manquant',
      'Créez-le pour documenter les variables requises'
    );
  }
}

function checkGitignore() {
  if (!fs.existsSync('.gitignore')) {
    checkWarning('.gitignore manquant');
    return;
  }

  const gitignore = fs.readFileSync('.gitignore', 'utf-8');

  // Vérifier que .env est ignoré
  if (gitignore.includes('.env') && !gitignore.includes('!.env.example')) {
    checkPassed('.env est bien dans .gitignore');
  } else {
    checkCritical(
      '.env n\'est PAS dans .gitignore',
      'Ajoutez .env à .gitignore IMMÉDIATEMENT'
    );
  }

  // Vérifier node_modules
  if (gitignore.includes('node_modules')) {
    checkPassed('node_modules est bien ignoré');
  } else {
    checkWarning('node_modules devrait être dans .gitignore');
  }
}

function checkSupabaseSetup() {
  // Vérifier les fichiers SQL
  const schemaFiles = [
    'supabase-schema.sql',
    'supabase-fix-notifications-rls.sql'
  ];

  schemaFiles.forEach(file => {
    if (fs.existsSync(file)) {
      checkPassed(`Schéma Supabase: ${file}`);
    }
  });

  // Vérifier lib/supabase.ts
  const supabasePath = 'lib/supabase.ts';
  if (fs.existsSync(supabasePath)) {
    checkPassed('Client Supabase configuré');
    
    const content = fs.readFileSync(supabasePath, 'utf-8');
    
    if (content.includes('EXPO_PUBLIC_SUPABASE_URL') && 
        content.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY')) {
      checkPassed('Variables Supabase utilisées correctement');
    } else {
      checkWarning('Vérifiez la configuration Supabase');
    }
  } else {
    checkCritical('lib/supabase.ts manquant', 'Créez la configuration Supabase');
  }
}

function checkAssets() {
  const assets = [
    { path: 'assets/icon.png', name: 'Icône', critical: true },
    { path: 'assets/splash.png', name: 'Splash screen', critical: false },
    { path: 'assets/adaptive-icon.png', name: 'Icône adaptative', critical: false }
  ];

  assets.forEach(asset => {
    if (fs.existsSync(asset.path)) {
      const stats = fs.statSync(asset.path);
      if (stats.size > 1000) {
        checkPassed(`${asset.name}: ${asset.path} (${Math.round(stats.size / 1024)}KB)`);
      } else {
        if (asset.critical) {
          checkCritical(
            `${asset.name} trop petit (placeholder?)`,
            'Créez une vraie image'
          );
        } else {
          checkWarning(`${asset.name} semble être un placeholder`);
        }
      }
    } else {
      if (asset.critical) {
        checkCritical(`${asset.name} manquant: ${asset.path}`);
      } else {
        checkWarning(`${asset.name} manquant: ${asset.path}`);
      }
    }
  });
}

function checkDependencies() {
  if (!fs.existsSync('package.json')) {
    checkCritical('package.json manquant');
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  // Vérifier les dépendances critiques
  const requiredDeps = [
    'expo',
    'react',
    'react-native',
    '@supabase/supabase-js'
  ];

  requiredDeps.forEach(dep => {
    if (packageJson.dependencies?.[dep]) {
      checkPassed(`Dépendance: ${dep}`);
    } else {
      checkCritical(`Dépendance manquante: ${dep}`);
    }
  });

  // Vérifier les scripts
  if (packageJson.scripts?.start) {
    checkPassed('Script "start" défini');
  } else {
    checkWarning('Script "start" manquant');
  }

  if (packageJson.scripts?.test) {
    checkPassed('Script "test" défini');
  } else {
    checkWarning('Script "test" manquant', 'Ajoutez un script de test');
  }
}

function checkGit() {
  if (fs.existsSync('.git')) {
    checkPassed('Git repository initialisé');
  } else {
    checkWarning('Pas de repository Git', 'Lancez: git init');
  }

  // Vérifier qu'il n'y a pas de fichiers non commités critiques
  // (on ne peut pas vérifier ça sans exécuter git status, mais on peut au moins le suggérer)
  log('  💡 Vérifiez manuellement: git status', 'cyan');
}

function checkVercelPages() {
  log('\n  🌐 Pages Web Requises (à déployer sur Vercel):', 'cyan');
  log('     • Page de confidentialité (Privacy Policy)', 'cyan');
  log('     • Conditions d\'utilisation (Terms of Service)', 'cyan');
  log('     • Page de support/contact', 'cyan');
  log('', 'cyan');
  log('     💡 Ces pages DOIVENT être hébergées sur un domaine HTTPS', 'yellow');
  log('     💡 Créez un repo avec ces pages et déployez sur Vercel', 'yellow');
  log('     💡 Puis mettez les URLs dans app.json', 'yellow');
}

function checkStoreAccounts() {
  log('\n  🏪 Comptes Store Requis:', 'cyan');
  log('     • Apple Developer Account: $99/an (developer.apple.com)', 'cyan');
  log('     • Google Play Console: $25 une fois (play.google.com/console)', 'cyan');
  log('', 'cyan');
  log('     ⚠️  Ces comptes sont OBLIGATOIRES pour publier', 'yellow');
}

// Main function
async function runChecks() {
  log('\n🔍 VS SPORT APP - VÉRIFICATION PRÉ-DÉPLOIEMENT', 'bright');
  log('='.repeat(70) + '\n', 'bright');

  logSection('1. CONFIGURATION APP', '📱');
  checkAppJson();

  logSection('2. CONFIGURATION EAS BUILD', '🔨');
  checkEasJson();

  logSection('3. VARIABLES D\'ENVIRONNEMENT', '🔐');
  checkEnvFiles();

  logSection('4. SÉCURITÉ GIT', '🔒');
  checkGitignore();

  logSection('5. BACKEND SUPABASE', '☁️');
  checkSupabaseSetup();

  logSection('6. ASSETS (ICÔNES & IMAGES)', '🎨');
  checkAssets();

  logSection('7. DÉPENDANCES', '📦');
  checkDependencies();

  logSection('8. VERSIONING', '📚');
  checkGit();

  logSection('9. PAGES WEB (VERCEL)', '🌐');
  checkVercelPages();

  logSection('10. COMPTES STORES', '🏪');
  checkStoreAccounts();

  // Résumé final
  logSection('RÉSUMÉ FINAL', '📊');

  log(`\n  Total de vérifications :`, 'bright');
  log(`  ✅ Réussies : ${passed}`, 'green');
  log(`  ⚠️  Avertissements : ${warnings}`, 'yellow');
  log(`  ❌ Problèmes critiques : ${criticalIssues}`, 'red');

  log('\n' + '='.repeat(70), 'cyan');

  if (criticalIssues === 0 && warnings === 0) {
    log('🎉 PARFAIT ! Vous êtes prêt à déployer !', 'green');
  } else if (criticalIssues === 0) {
    log('✅ PRESQUE PRÊT ! Corrigez les avertissements pour un déploiement optimal.', 'yellow');
  } else {
    log('❌ PAS PRÊT ! Corrigez les problèmes critiques avant de déployer.', 'red');
  }

  log('='.repeat(70) + '\n', 'cyan');

  // Checklist finale
  log('📋 CHECKLIST FINALE AVANT SOUMISSION:', 'bright');
  log('  [ ] Tous les problèmes critiques corrigés');
  log('  [ ] Pages Privacy/Terms déployées sur Vercel');
  log('  [ ] Comptes Apple & Google créés et payés');
  log('  [ ] App testée à fond (pas de bugs)');
  log('  [ ] Screenshots pris (5-10 par plateforme)');
  log('  [ ] Descriptions stores rédigées');
  log('  [ ] Backend Supabase en production');
  log('  [ ] Variables d\'environnement de prod configurées');
  log('');

  process.exit(criticalIssues > 0 ? 1 : 0);
}

// Run checks
runChecks().catch(err => {
  log(`\n❌ Erreur fatale: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
