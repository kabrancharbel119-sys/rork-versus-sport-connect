/**
 * Génère le hash du mot de passe pour le compte admin par défaut.
 * L’app utilise SHA256(password + 'vs_salt_2024') pour l’auth directe Supabase.
 *
 * Usage:
 *   node scripts/seed-default-admin.js
 *   node scripts/seed-default-admin.js MonMotDePasseSecret
 *
 * Puis exécuter le fichier supabase-seed-default-admin.sql dans l’éditeur SQL Supabase
 * en remplaçant le hash dans le fichier si vous avez utilisé un mot de passe personnalisé.
 */
const crypto = require('crypto');

const DEFAULT_PASSWORD = 'VS2026Admin!';
const SALT = 'vs_salt_2024';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

const password = process.argv[2] || DEFAULT_PASSWORD;
const hash = hashPassword(password);

console.log('Hash pour le mot de passe (auth Supabase / app):');
console.log(hash);
console.log('');
if (process.argv[2]) {
  console.log('Mot de passe personnalisé utilisé. Remplacez le password_hash dans supabase-seed-default-admin.sql par le hash ci-dessus.');
} else {
  console.log('Mot de passe par défaut: ' + DEFAULT_PASSWORD);
  console.log('Téléphone admin: +33600000000');
  console.log('Exécutez supabase-seed-default-admin.sql dans le SQL Editor Supabase.');
}
