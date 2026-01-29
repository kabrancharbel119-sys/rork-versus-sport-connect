#!/usr/bin/env node

/**
 * VS SPORT - Vérification Automatique
 * Détecte bugs sans build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const c = {
  g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', 
  b: '\x1b[34m', c: '\x1b[36m', x: '\x1b[0m'
};

let score = 0, max = 0, issues = [], warns = [];

const log = {
  ok: m => console.log(`${c.g}✅ ${m}${c.x}`),
  warn: m => console.log(`${c.y}⚠️  ${m}${c.x}`),
  err: m => console.log(`${c.r}❌ ${m}${c.x}`),
  title: m => console.log(`\n${c.c}━━━ ${m}${c.x}\n`)
};

function getFiles(dir, pat, ex = []) {
  let res = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const i of items) {
      const p = path.join(dir, i.name);
      if (ex.some(e => p.includes(e))) continue;
      if (i.isDirectory()) res.push(...getFiles(p, pat, ex));
      else if (pat.test(i.name)) res.push(p);
    }
  } catch {}
  return res;
}

console.log(`${c.c}
╔════════════════════════════════════════╗
║  VS SPORT - Vérification Auto          ║
╚════════════════════════════════════════╝${c.x}`);

// 1. TypeScript
log.title('1. TYPESCRIPT');
max += 20;
try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  log.ok('0 erreur TypeScript');
  score += 20;
} catch (e) {
  const out = e.stdout?.toString() || '';
  const n = (out.match(/error TS/g) || []).length;
  log.err(`${n} erreur(s) TypeScript`);
  issues.push(`TypeScript: ${n} erreurs`);
}

// 2. Protections ??
log.title('2. PROTECTIONS NULLABLES');
max += 15;
const files = getFiles('.', /\.(tsx|ts)$/, ['node_modules', 'e2e', '.expo']);
let tot = 0, prot = 0;
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/\.(map|filter|length)/g) || [];
  tot += m.length;
  if (c.includes('??') || c.includes('?.')) prot += m.length;
});
const pct = tot ? Math.round(prot / tot * 100) : 100;
if (pct >= 80) { log.ok(`${pct}% protections`); score += 15; }
else if (pct >= 50) { log.warn(`${pct}% protections`); score += 10; }
else { log.err(`${pct}% protections`); issues.push('Manque ?? et ?.'); }

// 3. useFocusEffect
log.title('3. USEFOCUSEFFECT');
max += 15;
const pf = 'app/(tabs)/profile/index.tsx';
if (fs.existsSync(pf)) {
  const c = fs.readFileSync(pf, 'utf8');
  if (c.includes('useRef') && c.includes('lastRefresh')) {
    log.ok('useFocusEffect a debounce');
    score += 15;
  } else {
    log.err('SANS debounce - Boucle infinie !');
    issues.push('useFocusEffect manque debounce');
  }
}

// 4. Boutons disabled
log.title('4. BOUTONS DISABLED');
max += 10;
const tf = 'app/(tabs)/teams/index.tsx';
if (fs.existsSync(tf)) {
  const c = fs.readFileSync(tf, 'utf8');
  if (c.includes('disabled={followingTeamId')) {
    log.ok('Bouton Suivre protégé');
    score += 10;
  } else {
    log.err('Bouton Suivre SANS disabled !');
    issues.push('Bouton Suivre manque disabled');
  }
}

// 5. AuthContext
log.title('5. AUTHCONTEXT');
max += 10;
const af = 'contexts/AuthContext.tsx';
if (fs.existsSync(af)) {
  const c = fs.readFileSync(af, 'utf8');
  if (c.includes('refreshUser') && c.match(/value=\{\{.*refreshUser/s)) {
    log.ok('refreshUser exporté');
    score += 10;
  } else {
    log.err('refreshUser NON exporté !');
    issues.push('refreshUser pas exporté');
  }
}

// 6. ChatContext
log.title('6. CHATCONTEXT');
max += 10;
const cf = 'contexts/ChatContext.tsx';
if (fs.existsSync(cf)) {
  const c = fs.readFileSync(cf, 'utf8');
  if (c.includes('useAuth') && c.includes('authUser')) {
    log.ok('ChatContext utilise authUser');
    score += 10;
  } else {
    log.warn('authUser non détecté');
    warns.push('ChatContext sans authUser');
  }
}

// 7. testIDs
log.title('7. TESTIDS');
max += 5;
let tid = 0;
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  tid += (c.match(/testID=/g) || []).length;
});
if (tid >= 30) { log.ok(`${tid} testIDs`); score += 5; }
else log.warn(`${tid} testIDs (add plus pour E2E)`);

// 8. console.log
log.title('8. CONSOLE.LOG');
max += 5;
let cl = 0;
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  cl += (c.match(/console\.log/g) || []).length;
});
if (cl === 0) { log.ok('0 console.log'); score += 5; }
else { log.warn(`${cl} console.log à nettoyer`); score += 2; }

// 9. Structure
log.title('9. STRUCTURE');
max += 5;
const req = ['package.json', 'app.json', 'eas.json'];
const mis = req.filter(f => !fs.existsSync(f));
if (!mis.length) { log.ok('Tous fichiers présents'); score += 5; }
else { log.warn(`Manquants: ${mis.join(', ')}`); }

// 10. Supabase
log.title('10. SUPABASE');
max += 5;
const sf = 'lib/supabase.ts';
if (fs.existsSync(sf)) {
  const c = fs.readFileSync(sf, 'utf8');
  if (c.includes('EXPO_PUBLIC_SUPABASE_URL')) {
    log.ok('Supabase configuré');
    score += 5;
  }
}

// Résumé
log.title('RÉSUMÉ');
const pct2 = Math.round(score / max * 100);
console.log(`\n📊 SCORE: ${score}/${max} (${pct2}%)\n`);

if (issues.length) {
  console.log(`${c.r}❌ PROBLÈMES (${issues.length}):${c.x}`);
  issues.forEach((i, n) => console.log(`   ${n + 1}. ${i}`));
  console.log('');
}

if (warns.length) {
  console.log(`${c.y}⚠️  AVERTISSEMENTS (${warns.length}):${c.x}`);
  warns.forEach((w, n) => console.log(`   ${n + 1}. ${w}`));
  console.log('');
}

if (pct2 >= 90) {
  console.log(`${c.g}✅ APP PRÊTE POUR BUILD ! 🚀${c.x}\n`);
  console.log('Commandes:');
  console.log('  git add .');
  console.log('  git commit -m "Ready for build"');
  console.log('  git push origin main');
  console.log('  eas build --platform android --profile preview\n');
} else if (pct2 >= 70) {
  console.log(`${c.y}⚠️  ACCEPTABLE - Corriger warnings${c.x}\n`);
} else {
  console.log(`${c.r}❌ PAS PRÊTE - Corriger problèmes !${c.x}\n`);
}
