#!/usr/bin/env node

/**
 * Script de vérification pré-déploiement production
 * Vérifie que tous les prérequis sont en place avant de déployer
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${COLORS.blue}ℹ${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`),
  warning: (msg) => console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`),
  section: (msg) => console.log(`\n${COLORS.cyan}${msg}${COLORS.reset}\n${'='.repeat(60)}`),
};

let errors = 0;
let warnings = 0;
let checks = 0;

function check(condition, successMsg, errorMsg, isWarning = false) {
  checks++;
  if (condition) {
    log.success(successMsg);
    return true;
  } else {
    if (isWarning) {
      log.warning(errorMsg);
      warnings++;
    } else {
      log.error(errorMsg);
      errors++;
    }
    return false;
  }
}

// ============================================================================
// 1. VÉRIFICATION DES FICHIERS ESSENTIELS
// ============================================================================

log.section('1. Fichiers essentiels');

const requiredFiles = [
  'package.json',
  'app.json',
  'eas.json',
  '.env.example',
  'backend/server.ts',
  'backend/hono.ts',
  'supabase/migrations/20260302_production_fixes.sql',
  'supabase-rls-production.sql',
  'legal-pages/privacy/index.html',
  'legal-pages/terms/index.html',
];

requiredFiles.forEach((file) => {
  const filePath = path.join(process.cwd(), file);
  check(
    fs.existsSync(filePath),
    `Fichier trouvé: ${file}`,
    `Fichier manquant: ${file}`
  );
});

// ============================================================================
// 2. VÉRIFICATION DE LA CONFIGURATION EAS
// ============================================================================

log.section('2. Configuration EAS');

try {
  const easConfig = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  
  check(
    easConfig.build?.production,
    'Profil production trouvé dans eas.json',
    'Profil production manquant dans eas.json'
  );

  if (easConfig.build?.production) {
    const prodEnv = easConfig.build.production.env || {};
    
    check(
      prodEnv.EXPO_PUBLIC_USE_BACKEND_AUTH === 'true',
      'EXPO_PUBLIC_USE_BACKEND_AUTH = true (authentification backend activée)',
      'EXPO_PUBLIC_USE_BACKEND_AUTH doit être "true" en production'
    );

    check(
      prodEnv.EXPO_PUBLIC_RORK_API_BASE_URL,
      `URL backend configurée: ${prodEnv.EXPO_PUBLIC_RORK_API_BASE_URL}`,
      'EXPO_PUBLIC_RORK_API_BASE_URL manquant en production'
    );

    check(
      prodEnv.EXPO_PUBLIC_RORK_API_BASE_URL?.startsWith('https://'),
      'URL backend utilise HTTPS',
      'URL backend devrait utiliser HTTPS en production',
      true
    );

    check(
      prodEnv.EXPO_PUBLIC_SUPABASE_URL,
      'EXPO_PUBLIC_SUPABASE_URL configuré',
      'EXPO_PUBLIC_SUPABASE_URL manquant'
    );

    check(
      prodEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      'EXPO_PUBLIC_SUPABASE_ANON_KEY configuré',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY manquant'
    );

    check(
      !prodEnv.EXPO_PUBLIC_SENTRY_DSN,
      'Sentry non configuré (optionnel)',
      'Sentry DSN configuré',
      true
    );
  }
} catch (error) {
  log.error(`Erreur lors de la lecture de eas.json: ${error.message}`);
  errors++;
}

// ============================================================================
// 3. VÉRIFICATION DU FICHIER .ENV.EXAMPLE
// ============================================================================

log.section('3. Variables d\'environnement');

try {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  
  const requiredEnvVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_RORK_API_BASE_URL',
    'EXPO_PUBLIC_USE_BACKEND_AUTH',
  ];

  requiredEnvVars.forEach((envVar) => {
    check(
      envExample.includes(envVar),
      `Variable documentée: ${envVar}`,
      `Variable manquante dans .env.example: ${envVar}`
    );
  });

  const backendEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ALLOWED_ORIGINS',
  ];

  backendEnvVars.forEach((envVar) => {
    check(
      envExample.includes(envVar),
      `Variable backend documentée: ${envVar}`,
      `Variable backend manquante dans .env.example: ${envVar}`,
      true
    );
  });
} catch (error) {
  log.error(`Erreur lors de la lecture de .env.example: ${error.message}`);
  errors++;
}

// ============================================================================
// 4. VÉRIFICATION DU PACKAGE.JSON
// ============================================================================

log.section('4. Configuration package.json');

try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  check(
    pkg.scripts?.backend,
    'Script backend défini',
    'Script "backend" manquant dans package.json'
  );

  check(
    pkg.scripts?.test,
    'Script test défini',
    'Script "test" manquant dans package.json'
  );

  check(
    pkg.scripts?.['test:e2e'],
    'Script test:e2e défini',
    'Script "test:e2e" manquant dans package.json'
  );

  const requiredDeps = [
    '@supabase/supabase-js',
    'expo',
    'expo-router',
    'hono',
    '@hono/node-server',
  ];

  requiredDeps.forEach((dep) => {
    check(
      pkg.dependencies?.[dep],
      `Dépendance installée: ${dep}`,
      `Dépendance manquante: ${dep}`
    );
  });
} catch (error) {
  log.error(`Erreur lors de la lecture de package.json: ${error.message}`);
  errors++;
}

// ============================================================================
// 5. VÉRIFICATION DU APP.JSON
// ============================================================================

log.section('5. Configuration app.json');

try {
  const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const expo = appConfig.expo || {};
  
  check(
    expo.name,
    `Nom de l'app: ${expo.name}`,
    'Nom de l\'app manquant dans app.json'
  );

  check(
    expo.slug,
    `Slug: ${expo.slug}`,
    'Slug manquant dans app.json'
  );

  check(
    expo.version,
    `Version: ${expo.version}`,
    'Version manquante dans app.json'
  );

  check(
    expo.ios?.bundleIdentifier,
    `Bundle ID iOS: ${expo.ios?.bundleIdentifier}`,
    'Bundle identifier iOS manquant',
    true
  );

  check(
    expo.android?.package,
    `Package Android: ${expo.android?.package}`,
    'Package Android manquant',
    true
  );

  const privacyUrl = expo.ios?.config?.privacyManifests?.NSPrivacyAccessedAPITypes?.[0]?.NSPrivacyAccessedAPITypeReasons?.[0] || expo.web?.config?.privacyPolicy;
  const termsUrl = expo.web?.config?.termsOfService;

  check(
    privacyUrl || expo.extra?.privacyPolicyUrl,
    'URL Privacy Policy configurée',
    'URL Privacy Policy manquante (requise pour les stores)',
    true
  );

  check(
    termsUrl || expo.extra?.termsOfServiceUrl,
    'URL Terms of Service configurée',
    'URL Terms of Service manquante (requise pour les stores)',
    true
  );
} catch (error) {
  log.error(`Erreur lors de la lecture de app.json: ${error.message}`);
  errors++;
}

// ============================================================================
// 6. VÉRIFICATION DES PAGES LÉGALES
// ============================================================================

log.section('6. Pages légales');

const legalPages = [
  { file: 'legal-pages/privacy/index.html', name: 'Privacy Policy' },
  { file: 'legal-pages/terms/index.html', name: 'Terms of Service' },
];

legalPages.forEach(({ file, name }) => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    
    check(
      content.length > 1000,
      `${name}: Contenu présent (${content.length} caractères)`,
      `${name}: Contenu trop court (${content.length} caractères)`,
      true
    );

    check(
      content.includes('<!DOCTYPE html>') || content.includes('<html'),
      `${name}: Format HTML valide`,
      `${name}: Format HTML invalide`
    );
  }
});

// ============================================================================
// 7. VÉRIFICATION DES MIGRATIONS SQL
// ============================================================================

log.section('7. Migrations SQL');

const migrationFile = 'supabase/migrations/20260302_production_fixes.sql';
if (fs.existsSync(migrationFile)) {
  const migration = fs.readFileSync(migrationFile, 'utf8');
  
  const requiredConstraints = [
    'matches_entry_fee_check',
    'matches_max_players_check',
    'matches_prize_check',
    'users_stats_check',
  ];

  requiredConstraints.forEach((constraint) => {
    check(
      migration.includes(constraint),
      `Contrainte trouvée: ${constraint}`,
      `Contrainte manquante: ${constraint}`
    );
  });

  const requiredPolicies = [
    'Users can view their own notifications',
    'Users can update their own notifications',
    'Users can delete their own notifications',
  ];

  requiredPolicies.forEach((policy) => {
    check(
      migration.includes(policy),
      `Politique RLS trouvée: ${policy}`,
      `Politique RLS manquante: ${policy}`
    );
  });

  const requiredIndexes = [
    'idx_matches_venue_id',
    'idx_matches_created_by',
    'idx_notifications_user_id',
    'idx_notifications_read',
  ];

  requiredIndexes.forEach((index) => {
    check(
      migration.includes(index),
      `Index trouvé: ${index}`,
      `Index manquant: ${index}`
    );
  });
}

// ============================================================================
// 8. VÉRIFICATION DU BACKEND
// ============================================================================

log.section('8. Backend');

const backendFiles = [
  'backend/server.ts',
  'backend/hono.ts',
  'backend/auth-routes.ts',
];

backendFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    
    if (file === 'backend/server.ts') {
      check(
        content.includes('SUPABASE_URL') || content.includes('process.env'),
        'Backend lit les variables d\'environnement',
        'Backend ne semble pas lire les variables d\'environnement',
        true
      );

      check(
        content.includes('PORT') || content.includes('3000'),
        'Port configuré',
        'Port non configuré',
        true
      );
    }

    if (file === 'backend/hono.ts') {
      check(
        content.includes('cors') || content.includes('CORS'),
        'CORS configuré',
        'CORS non configuré (peut causer des problèmes en production)',
        true
      );
    }
  }
});

// ============================================================================
// 9. VÉRIFICATION DES TESTS
// ============================================================================

log.section('9. Tests');

check(
  fs.existsSync('__tests__'),
  'Dossier de tests trouvé',
  'Dossier de tests manquant',
  true
);

check(
  fs.existsSync('jest.config.js'),
  'Configuration Jest trouvée',
  'Configuration Jest manquante',
  true
);

check(
  fs.existsSync('jest.config.e2e.js'),
  'Configuration Jest E2E trouvée',
  'Configuration Jest E2E manquante',
  true
);

// ============================================================================
// RÉSUMÉ
// ============================================================================

log.section('Résumé de la vérification');

console.log(`Total de vérifications: ${checks}`);
console.log(`${COLORS.green}Succès: ${checks - errors - warnings}${COLORS.reset}`);
console.log(`${COLORS.yellow}Avertissements: ${warnings}${COLORS.reset}`);
console.log(`${COLORS.red}Erreurs: ${errors}${COLORS.reset}`);

console.log('\n' + '='.repeat(60) + '\n');

if (errors === 0 && warnings === 0) {
  log.success('✨ Félicitations ! L\'application est prête pour la production.');
  console.log('\nProchaines étapes:');
  console.log('1. Appliquer la migration SQL sur Supabase');
  console.log('2. Déployer le backend (Railway, Render, etc.)');
  console.log('3. Configurer les variables d\'environnement backend');
  console.log('4. Configurer Sentry (optionnel)');
  console.log('5. Builder avec: eas build --platform all --profile production');
  console.log('6. Soumettre aux stores: eas submit --platform all');
  console.log('\nConsultez GUIDE_DEPLOIEMENT_PRODUCTION.md pour plus de détails.');
  process.exit(0);
} else if (errors === 0) {
  log.warning(`⚠️  L'application peut être déployée mais avec ${warnings} avertissement(s).`);
  console.log('\nVeuillez vérifier les avertissements ci-dessus.');
  console.log('Consultez GUIDE_DEPLOIEMENT_PRODUCTION.md pour plus de détails.');
  process.exit(0);
} else {
  log.error(`❌ L'application N'EST PAS prête pour la production (${errors} erreur(s)).`);
  console.log('\nVeuillez corriger les erreurs ci-dessus avant de déployer.');
  console.log('Consultez GUIDE_DEPLOIEMENT_PRODUCTION.md pour plus de détails.');
  process.exit(1);
}
