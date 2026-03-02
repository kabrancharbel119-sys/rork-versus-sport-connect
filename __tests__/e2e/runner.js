const fs = require('fs');
const path = require('path');

// Lire le fichier JSON généré par Jest
const reportPath = path.join(__dirname, '..', '..', 'test-report.json');

if (!fs.existsSync(reportPath)) {
  console.error('❌ Fichier test-report.json introuvable. Exécutez d\'abord les tests avec --json');
  process.exit(1);
}

const jestReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Analyser les résultats
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  bugs: [],
  testsByFile: {}
};

jestReport.testResults.forEach(fileResult => {
  const fileName = path.basename(fileResult.name);
  
  results.testsByFile[fileName] = {
    total: fileResult.assertionResults.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: fileResult.endTime - fileResult.startTime,
    tests: []
  };

  fileResult.assertionResults.forEach(test => {
    results.total++;
    
    const testInfo = {
      name: test.title,
      status: test.status,
      duration: test.duration || 0,
      error: test.failureMessages.join('\n')
    };

    results.testsByFile[fileName].tests.push(testInfo);

    if (test.status === 'passed') {
      results.passed++;
      results.testsByFile[fileName].passed++;
    } else if (test.status === 'failed') {
      results.failed++;
      results.testsByFile[fileName].failed++;
      
      // Analyser le bug
      const bug = analyzeBug(test, fileName);
      results.bugs.push(bug);
    } else {
      results.skipped++;
      results.testsByFile[fileName].skipped++;
    }
  });
});

// Calculer le score qualité
const qualityScore = results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0;

// Fonction pour analyser un bug
function analyzeBug(test, fileName) {
  const errorMessage = test.failureMessages.join('\n');
  
  let severity = 'medium';
  let cause = 'Erreur non identifiée';
  let fix = 'Vérifier les logs pour plus de détails';

  // Détection de la sévérité
  if (errorMessage.includes('RLS') || errorMessage.includes('security') || errorMessage.includes('unauthorized')) {
    severity = 'critical';
    cause = 'Violation de sécurité RLS';
    fix = 'Vérifier les politiques RLS dans Supabase et s\'assurer que les permissions sont correctement configurées';
  } else if (errorMessage.includes('null') || errorMessage.includes('undefined') || errorMessage.includes('not found')) {
    severity = 'high';
    cause = 'Données manquantes ou null';
    fix = 'Vérifier que toutes les colonnes requises sont présentes et que les valeurs par défaut sont définies';
  } else if (errorMessage.includes('type') || errorMessage.includes('JSONB') || errorMessage.includes('array')) {
    severity = 'high';
    cause = 'Incohérence de type de données';
    fix = 'Vérifier que les types JSONB/Array sont correctement définis dans le schéma et l\'API';
  } else if (errorMessage.includes('constraint') || errorMessage.includes('unique') || errorMessage.includes('foreign key')) {
    severity = 'high';
    cause = 'Violation de contrainte de base de données';
    fix = 'Vérifier les contraintes FK et unique, s\'assurer que les données respectent les contraintes';
  } else if (errorMessage.includes('timeout') || errorMessage.includes('performance')) {
    severity = 'medium';
    cause = 'Problème de performance';
    fix = 'Ajouter des index sur les colonnes fréquemment interrogées';
  } else if (errorMessage.includes('ELO') || errorMessage.includes('calculation')) {
    severity = 'high';
    cause = 'Erreur de calcul ELO';
    fix = 'Vérifier la formule ELO et les K-factors dans lib/api/ranking.ts';
  }

  return {
    file: fileName,
    test: test.title,
    severity,
    cause,
    fix,
    error: errorMessage.substring(0, 500)
  };
}

// Générer le rapport terminal
console.log('\n┌─────────────────────────────────────────┐');
console.log('│        VS SPORT — TEST REPORT           │');
console.log('├─────────────────────────────────────────┤');
console.log(`│  Total tests : ${results.total.toString().padEnd(24)} │`);
console.log(`│  ✅ Passés   : ${results.passed.toString().padEnd(6)} (${Math.round((results.passed/results.total)*100)}%)${' '.repeat(13)}│`);
console.log(`│  ❌ Échoués  : ${results.failed.toString().padEnd(6)} (${Math.round((results.failed/results.total)*100)}%)${' '.repeat(13)}│`);
console.log(`│  ⏭ Skippés  : ${results.skipped.toString().padEnd(6)} (${Math.round((results.skipped/results.total)*100)}%)${' '.repeat(13)}│`);
console.log(`│  Score qualité : ${qualityScore}/100${' '.repeat(19)}│`);
console.log('├─────────────────────────────────────────┤');
console.log(`│  🐛 BUGS DÉTECTÉS (${results.bugs.length})${' '.repeat(19)}│`);

const criticalBugs = results.bugs.filter(b => b.severity === 'critical').length;
const highBugs = results.bugs.filter(b => b.severity === 'high').length;
const mediumBugs = results.bugs.filter(b => b.severity === 'medium').length;
const lowBugs = results.bugs.filter(b => b.severity === 'low').length;

console.log(`│  🔴 Critical : ${criticalBugs.toString().padEnd(26)}│`);
console.log(`│  🟠 High     : ${highBugs.toString().padEnd(26)}│`);
console.log(`│  🟡 Medium   : ${mediumBugs.toString().padEnd(26)}│`);
console.log(`│  🟢 Low      : ${lowBugs.toString().padEnd(26)}│`);
console.log('└─────────────────────────────────────────┘\n');

// Générer le rapport HTML
const htmlReport = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VS Sport - Rapport de Tests E2E</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { opacity: 0.9; font-size: 16px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
    .stat-card h3 { font-size: 14px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
    .stat-card .value { font-size: 36px; font-weight: bold; color: #333; }
    .stat-card .percentage { font-size: 14px; color: #999; margin-top: 4px; }
    .section { padding: 30px; border-top: 1px solid #eee; }
    .section h2 { font-size: 24px; margin-bottom: 20px; color: #333; }
    .file-result { margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    .file-header { background: #f8f9fa; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .file-header:hover { background: #e9ecef; }
    .file-name { font-weight: 600; color: #333; }
    .file-stats { display: flex; gap: 15px; font-size: 14px; }
    .file-stats span { padding: 4px 12px; border-radius: 12px; background: white; }
    .passed { color: #28a745; }
    .failed { color: #dc3545; }
    .skipped { color: #ffc107; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-top: 10px; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s; }
    .test-list { padding: 20px; background: white; }
    .test-item { padding: 12px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
    .test-item:last-child { border-bottom: none; }
    .test-name { flex: 1; }
    .test-status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-passed { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .status-skipped { background: #fff3cd; color: #856404; }
    .bugs-section { padding: 30px; background: #fff8f8; }
    .bug-card { background: white; border-left: 4px solid #dc3545; padding: 20px; margin-bottom: 15px; border-radius: 4px; }
    .bug-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; }
    .bug-title { font-weight: 600; color: #333; flex: 1; }
    .severity { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .severity-critical { background: #dc3545; color: white; }
    .severity-high { background: #fd7e14; color: white; }
    .severity-medium { background: #ffc107; color: #333; }
    .severity-low { background: #28a745; color: white; }
    .bug-details { font-size: 14px; color: #666; margin-bottom: 8px; }
    .bug-fix { background: #e7f3ff; padding: 12px; border-radius: 4px; font-size: 14px; color: #004085; margin-top: 12px; }
    .bug-fix strong { display: block; margin-bottom: 4px; }
    .score-badge { display: inline-block; padding: 8px 20px; background: ${qualityScore >= 90 ? '#28a745' : qualityScore >= 70 ? '#ffc107' : '#dc3545'}; color: white; border-radius: 20px; font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏆 VS Sport - Rapport de Tests E2E</h1>
      <p>Suite de tests exhaustive pour détecter 100% des bugs</p>
      <div style="margin-top: 20px;">
        <span class="score-badge">Score: ${qualityScore}/100</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <h3>Total Tests</h3>
        <div class="value">${results.total}</div>
      </div>
      <div class="stat-card">
        <h3>✅ Passés</h3>
        <div class="value passed">${results.passed}</div>
        <div class="percentage">${Math.round((results.passed/results.total)*100)}%</div>
      </div>
      <div class="stat-card">
        <h3>❌ Échoués</h3>
        <div class="value failed">${results.failed}</div>
        <div class="percentage">${Math.round((results.failed/results.total)*100)}%</div>
      </div>
      <div class="stat-card">
        <h3>⏭ Skippés</h3>
        <div class="value skipped">${results.skipped}</div>
        <div class="percentage">${Math.round((results.skipped/results.total)*100)}%</div>
      </div>
    </div>

    <div class="section">
      <h2>📊 Résultats par Fichier</h2>
      ${Object.entries(results.testsByFile).map(([fileName, fileData]) => `
        <div class="file-result">
          <div class="file-header">
            <div class="file-name">${fileName}</div>
            <div class="file-stats">
              <span class="passed">✅ ${fileData.passed}</span>
              <span class="failed">❌ ${fileData.failed}</span>
              <span class="skipped">⏭ ${fileData.skipped}</span>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(fileData.passed/fileData.total)*100}%"></div>
          </div>
          <div class="test-list">
            ${fileData.tests.map(test => `
              <div class="test-item">
                <div class="test-name">${test.name}</div>
                <span class="test-status status-${test.status}">${test.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    ${results.bugs.length > 0 ? `
    <div class="bugs-section">
      <h2>🐛 Bugs Détectés (${results.bugs.length})</h2>
      ${results.bugs.map(bug => `
        <div class="bug-card">
          <div class="bug-header">
            <div class="bug-title">${bug.test}</div>
            <span class="severity severity-${bug.severity}">${bug.severity}</span>
          </div>
          <div class="bug-details">📁 ${bug.file}</div>
          <div class="bug-details">🔍 Cause: ${bug.cause}</div>
          <div class="bug-fix">
            <strong>💡 Correction suggérée:</strong>
            ${bug.fix}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  </div>
</body>
</html>
`;

// Sauvegarder le rapport HTML
fs.writeFileSync(path.join(__dirname, '..', '..', 'test-report.html'), htmlReport);
console.log('✅ Rapport HTML généré: test-report.html\n');

// Générer le fichier bugs-to-fix.md
const bugsMarkdown = `# 🐛 VS Sport - Bugs à Corriger

**Date:** ${new Date().toLocaleDateString('fr-FR')}
**Score Qualité:** ${qualityScore}/100
**Total Bugs:** ${results.bugs.length}

## 📊 Résumé

- 🔴 **Critical:** ${criticalBugs} bugs
- 🟠 **High:** ${highBugs} bugs
- 🟡 **Medium:** ${mediumBugs} bugs
- 🟢 **Low:** ${lowBugs} bugs

---

${results.bugs.map((bug, index) => `
## ${index + 1}. ${bug.test}

**Fichier:** \`${bug.file}\`
**Sévérité:** ${bug.severity === 'critical' ? '🔴' : bug.severity === 'high' ? '🟠' : bug.severity === 'medium' ? '🟡' : '🟢'} ${bug.severity.toUpperCase()}

### 🔍 Cause
${bug.cause}

### 💡 Correction
\`\`\`
${bug.fix}
\`\`\`

### ❌ Erreur
\`\`\`
${bug.error}
\`\`\`

---
`).join('\n')}

## ✅ Actions Recommandées

1. Corriger d'abord les bugs **Critical** (sécurité, données perdues)
2. Puis les bugs **High** (fonctionnalités principales cassées)
3. Ensuite les bugs **Medium** (comportements inattendus)
4. Enfin les bugs **Low** (cosmétiques, performance)

## 📝 Notes

- Exécuter les tests après chaque correction: \`npm run test:e2e\`
- Vérifier que le score qualité augmente
- Documenter les corrections dans le changelog
`;

fs.writeFileSync(path.join(__dirname, '..', '..', 'bugs-to-fix.md'), bugsMarkdown);
console.log('✅ Rapport Markdown généré: bugs-to-fix.md\n');

// Sauvegarder les résultats détaillés en JSON
fs.writeFileSync(
  path.join(__dirname, '..', '..', 'test-results-detailed.json'),
  JSON.stringify(results, null, 2)
);
console.log('✅ Résultats détaillés sauvegardés: test-results-detailed.json\n');

// Code de sortie basé sur le score
if (qualityScore < 70) {
  console.log('⚠️  Score qualité insuffisant (< 70%). Corrections requises.\n');
  process.exit(1);
} else if (qualityScore < 90) {
  console.log('⚠️  Score qualité acceptable mais améliorable (< 90%).\n');
  process.exit(0);
} else {
  console.log('✅ Excellent score qualité (>= 90%) ! 🎉\n');
  process.exit(0);
}
