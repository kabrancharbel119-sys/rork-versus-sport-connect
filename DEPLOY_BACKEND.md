# Déployer le backend VS Sport Connect

Le backend (Hono + tRPC + auth) est dans `backend/`. Il doit être hébergé sur une URL HTTPS pour que l’app en production puisse l’utiliser (`EXPO_PUBLIC_RORK_API_BASE_URL`).

---

## Prérequis

- **Variables d’environnement** à configurer sur la plateforme :
  - `SUPABASE_URL` – URL de votre projet Supabase
  - `SUPABASE_SERVICE_ROLE_KEY` – Clé service role (secrète)
  - `ALLOWED_ORIGINS` (recommandé en prod) – ex. `https://rork.com,https://app.rork.com`
  - `RESEND_API_KEY` (optionnel) – pour les emails (vérification, reset mot de passe)

---

## Lancer le backend en local

```bash
npm run backend
```

Le serveur écoute sur `http://localhost:3000` (ou `PORT` si défini). Vérifier : `curl http://localhost:3000` → `{"status":"ok","message":"API is running"}`.

---

## Option 1 : Railway

1. Créer un compte sur [railway.app](https://railway.app).
2. **New Project** → **Deploy from GitHub repo** (ou **Empty project** puis déploiement manuel).
3. Si GitHub : choisir ce dépôt, **Root Directory** = racine du projet (pas seulement `backend/`).
4. **Variables** (Settings → Variables) :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_ORIGINS` = `https://rork.com` (ou vos domaines)
   - Optionnel : `RESEND_API_KEY`
5. **Build & Deploy** :
   - **Build Command** : `npm install`
   - **Start Command** : `npm run backend`
   - **Watch Paths** (optionnel) : `backend/**` pour ne redéployer que quand le backend change.
6. Railway attribue une URL (ex. `https://xxx.up.railway.app`). Vous pouvez ajouter un **custom domain** (ex. `api.rork.com`).
7. Dans **eas.json** (profil production) ou EAS Secrets, définir :
   - `EXPO_PUBLIC_RORK_API_BASE_URL` = l’URL Railway (ex. `https://api.rork.com` si domaine personnalisé).

---

## Option 2 : Render

1. Créer un compte sur [render.com](https://render.com).
2. **New** → **Web Service**.
3. Connecter le repo GitHub (ce dépôt).
4. **Build & Deploy** :
   - **Build Command** : `npm install`
   - **Start Command** : `npm run backend`
   - **Root Directory** : laisser vide (racine).
5. **Environment** : ajouter les variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, éventuellement `RESEND_API_KEY`.
6. Render donne une URL (ex. `https://xxx.onrender.com`). Vous pouvez ajouter un **Custom Domain** (ex. `api.rork.com`).
7. Mettre à jour `EXPO_PUBLIC_RORK_API_BASE_URL` dans l’app (eas.json / EAS Secrets) avec cette URL.

---

## Option 3 : Fly.io

1. Installer [flyctl](https://fly.io/docs/hands-on/install-flyctl/) et se connecter : `fly auth login`.
2. À la racine du projet :

```bash
fly launch
```

- Choisir une région, ne pas ajouter de base de données si tout est sur Supabase.
3. Définir les secrets :

```bash
fly secrets set SUPABASE_URL="https://xxx.supabase.co"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="votre_cle"
fly secrets set ALLOWED_ORIGINS="https://rork.com"
```

4. Dans `fly.toml` (créé par `fly launch`), vérifier :

```toml
[env]
  PORT = "8080"

[http_service]
  internal_port = 3000
```

Adapter si besoin : le backend lit `process.env.PORT` (Fly injecte souvent 8080). Si Fly utilise 8080, mettre dans le backend `port = Number(process.env.PORT) || 8080` ou laisser 3000 et définir dans fly.toml `internal_port = 3000` et `PORT=3000` en env.
5. Déployer : `fly deploy`.
6. L’URL sera `https://xxx.fly.dev`. Custom domain possible dans **Settings**.
7. Mettre `EXPO_PUBLIC_RORK_API_BASE_URL` sur cette URL.

---

## Option 4 : Vercel (serverless)

Hono peut tourner sur Vercel en mode serverless. Il faut exposer un handler pour Vercel.

1. Créer `api/index.ts` (à la racine ou dans `backend/`) qui exporte le handler Hono pour Vercel (voir [Hono Vercel adapter](https://hono.dev/docs/deployment/vercel)).
2. Ou déployer uniquement le backend dans un sous-dossier avec `vercel.json` qui pointe les routes vers le handler.

Alternative simple : utiliser Railway ou Render pour un serveur toujours actif ; Vercel convient si vous acceptez de configurer l’adapter Hono pour Vercel.

---

## Option 5 : VPS (Node ou Bun)

Sur un serveur (DigitalOcean, OVH, etc.) :

1. Cloner le repo, puis `npm install`.
2. Variables d’environnement : les mettre dans un fichier `.env` (jamais committé) ou les exporter dans le shell.
3. Lancer avec Node : `npm run backend` (utilise `tsx`). Ou compiler le backend en JS et lancer `node backend/server.js`.
4. Utiliser **pm2** ou **systemd** pour garder le processus actif et redémarrer en cas de crash.
5. Mettre un reverse proxy (Nginx / Caddy) devant avec HTTPS et pointer le domaine (ex. `api.rork.com`) vers le port du backend.

Exemple pm2 :

```bash
npm install -g pm2
pm2 start "npm run backend" --name vs-backend
pm2 save && pm2 startup
```

---

## Vérifications après déploiement

- **Health** : `curl https://VOTRE_URL_API/` → `{"status":"ok","message":"API is running"}`.
- **Auth** : tester login/register depuis l’app en prod ou avec Postman (POST `/api/auth/login`, etc.).
- **CORS** : si l’app tourne sur `https://rork.com`, mettre `ALLOWED_ORIGINS=https://rork.com` pour éviter les erreurs CORS.

---

## Récap

| Plateforme | Difficulté | Coût typique | Custom domain |
|------------|------------|--------------|---------------|
| Railway    | Facile     | Gratuit / payant | Oui |
| Render     | Facile     | Gratuit (spin down) / payant | Oui |
| Fly.io     | Moyen      | Gratuit / payant | Oui |
| VPS        | Plus technique | Variable | Oui |

Une fois le backend déployé, mettre l’URL dans `EXPO_PUBLIC_RORK_API_BASE_URL` (profil production dans `eas.json` ou EAS Secrets) et rebuild l’app pour la prod.
