#!/usr/bin/env node

/**
 * =====================================================
 * VS Sport App - Correction des Icônes
 * =====================================================
 * 
 * Ce script copie les icônes depuis assets/images/ vers assets/
 * pour qu'elles soient trouvées par le script de vérification.
 */

const fs = require('fs');
const path = require('path');

// Couleurs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function copyFile(source, destination) {
  try {
    // Créer le dossier destination s'il n'existe pas
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      log(`  📁 Dossier créé: ${destDir}`, 'cyan');
    }

    // Copier le fichier
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, destination);
      const stats = fs.statSync(destination);
      const sizeKB = Math.round(stats.size / 1024);
      log(`  ✅ Copié: ${path.basename(destination)} (${sizeKB} KB)`, 'green');
      return true;
    } else {
      log(`  ⚠️  Source non trouvée: ${source}`, 'yellow');
      return false;
    }
  } catch (err) {
    log(`  ❌ Erreur lors de la copie: ${err.message}`, 'red');
    return false;
  }
}

async function fixIcons() {
  log('\n🎨 VS SPORT APP - CORRECTION DES ICÔNES\n', 'cyan');
  log('='.repeat(70) + '\n', 'cyan');

  const baseDir = process.cwd();

  // Liste des icônes à copier
  const iconsToCopy = [
    {
      source: path.join(baseDir, 'assets', 'images', 'icon.png'),
      dest: path.join(baseDir, 'assets', 'icon.png'),
      required: true
    },
    {
      source: path.join(baseDir, 'assets', 'images', 'splash-icon.png'),
      dest: path.join(baseDir, 'assets', 'splash.png'),
      required: false
    },
    {
      source: path.join(baseDir, 'assets', 'images', 'adaptive-icon.png'),
      dest: path.join(baseDir, 'assets', 'adaptive-icon.png'),
      required: false
    }
  ];

  let successCount = 0;
  let failCount = 0;

  log('📋 Copie des icônes depuis assets/images/ vers assets/\n', 'cyan');

  for (const icon of iconsToCopy) {
    const iconName = path.basename(icon.dest);
    log(`\n🖼️  ${iconName}:`, 'cyan');
    
    const success = copyFile(icon.source, icon.dest);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
      if (icon.required) {
        log(`     ⚠️  Cette icône est REQUISE pour les stores`, 'yellow');
      }
    }
  }

  // Résumé
  log('\n' + '='.repeat(70), 'cyan');
  log('\n📊 RÉSUMÉ:', 'cyan');
  log(`  ✅ Copiées avec succès: ${successCount}`, 'green');
  
  if (failCount > 0) {
    log(`  ❌ Échecs: ${failCount}`, 'red');
  }

  // Vérifications supplémentaires
  log('\n🔍 VÉRIFICATION DES DIMENSIONS:\n', 'cyan');

  const iconPath = path.join(baseDir, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    try {
      const { execSync } = require('child_process');
      
      // Essayer d'obtenir les dimensions (nécessite ImageMagick ou autre)
      log('  💡 Pour vérifier les dimensions de vos icônes:', 'yellow');
      log('     • Icône principale (icon.png): doit être 1024x1024px', 'yellow');
      log('     • Splash screen (splash.png): doit être au moins 1242x2436px', 'yellow');
      log('     • Icône adaptative: doit être 1024x1024px\n', 'yellow');
    } catch (err) {
      // Ignore si ImageMagick n'est pas installé
    }
  }

  // Instructions finales
  log('='.repeat(70), 'cyan');
  
  if (successCount > 0) {
    log('\n✅ SUCCÈS ! Les icônes ont été copiées.', 'green');
    log('\n📋 PROCHAINES ÉTAPES:', 'cyan');
    log('  1. Vérifiez que les icônes sont bien visibles dans assets/', 'cyan');
    log('  2. Relancez le script de vérification:', 'cyan');
    log('     node pre-deployment-check.js\n', 'yellow');
  } else {
    log('\n⚠️  ATTENTION ! Aucune icône n\'a été copiée.', 'yellow');
    log('\n📋 ACTIONS REQUISES:', 'cyan');
    log('  1. Vérifiez que vous avez des icônes dans assets/images/', 'cyan');
    log('  2. Si vous n\'avez pas d\'icônes, créez-les:', 'cyan');
    log('     • icon.png: 1024x1024px (icône principale)', 'yellow');
    log('     • splash.png: 1242x2436px (écran de démarrage)', 'yellow');
    log('     • adaptive-icon.png: 1024x1024px (Android)', 'yellow');
    log('  3. Placez-les dans assets/images/ puis relancez ce script\n', 'cyan');
  }

  log('='.repeat(70) + '\n', 'cyan');
}

// Exécuter
fixIcons().catch(err => {
  log(`\n❌ Erreur fatale: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
