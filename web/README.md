# Pages Web VS (Versus) - Hébergement

Ce dossier contient les pages web statiques pour la politique de confidentialité et les conditions d'utilisation de VS (Versus).

## Fichiers

- `privacy.html` - Politique de confidentialité (avec section suppression de compte)
- `terms.html` - Conditions d'utilisation
- `child-safety.html` - Normes de sécurité des enfants (requis Google Play)

## Hébergement rapide (gratuit)

### Option 1 : Netlify (Recommandé - Le plus simple)

1. Créer un compte sur [netlify.com](https://netlify.com)
2. Glisser-déposer le dossier `web/` dans Netlify Drop
3. Netlify génère une URL : `https://versus-sport-XXXXX.netlify.app`
4. (Optionnel) Configurer un domaine personnalisé : `versus-sport.com`

**URLs finales :**
- Privacy: `https://versus-sport-XXXXX.netlify.app/privacy.html`
- Terms: `https://versus-sport-XXXXX.netlify.app/terms.html`

### Option 2 : GitHub Pages

1. Créer un repo GitHub public `versus-sport-legal`
2. Pousser les fichiers HTML
3. Activer GitHub Pages dans Settings → Pages
4. URL : `https://[username].github.io/versus-sport-legal/privacy.html`

### Option 3 : Vercel

1. Créer un compte sur [vercel.com](https://vercel.com)
2. Importer le dossier `web/`
3. Déployer
4. URL : `https://versus-sport.vercel.app/privacy.html`

## Pour Google Play Console

Une fois hébergé, utilise ces URLs dans Play Console :

**Privacy Policy URL:**
```
https://[ton-domaine]/privacy.html
```

**Account Deletion URL (Data Safety):**
```
https://[ton-domaine]/privacy.html#account-deletion
```

**Terms of Service URL:**
```
https://[ton-domaine]/terms.html
```

**Child Safety Standards URL (Normes de sécurité des enfants):**
```
https://[ton-domaine]/child-safety.html
```

## Mise à jour

Pour mettre à jour les pages :
1. Modifier les fichiers HTML localement
2. Re-déployer sur ton hébergeur (Netlify/Vercel/GitHub Pages)
3. Les URLs restent identiques

## Notes

- Les pages sont 100% statiques (HTML/CSS uniquement)
- Pas de backend requis
- Responsive (mobile-friendly)
- Conformes GDPR et Google Play
- Section suppression de compte avec ancre `#account-deletion`
