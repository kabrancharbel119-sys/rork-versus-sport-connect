# Pages légales (Privacy & Terms)

Ces pages doivent être **hébergées en HTTPS** pour que l’app puisse les utiliser dans les fiches App Store / Google Play (URLs requises par Apple et Google).

## URLs attendues

- **Politique de confidentialité :** `https://rork.com/privacy`
- **Conditions d’utilisation :** `https://rork.com/terms`

## Déploiement

### Option 1 : Vercel

1. Créer un projet Vercel et connecter ce dossier (ou un repo qui contient `legal-pages/`).
2. Configurer le **Root Directory** sur `legal-pages`.
3. Déployer : les routes `/privacy` et `/terms` seront servies via `privacy/index.html` et `terms/index.html`.
4. Attacher le domaine `rork.com` dans les paramètres Vercel (Settings → Domains).

### Option 2 : Autre hébergeur (Netlify, GitHub Pages, serveur)

- Copier le contenu de `legal-pages/` à la racine du site de `rork.com`.
- Vérifier que :
  - `https://rork.com/privacy` sert `privacy/index.html`
  - `https://rork.com/terms` sert `terms/index.html`

### Option 3 : Sous-dossier sur un site existant

Si rork.com existe déjà, placer `privacy/index.html` et `terms/index.html` dans les chemins `/privacy/` et `/terms/` du site.

## Contenu

Le contenu des pages est aligné sur les écrans in-app (`app/privacy.tsx` et `app/terms.tsx`). En cas de mise à jour des textes, mettre à jour à la fois les écrans et ces fichiers HTML.
