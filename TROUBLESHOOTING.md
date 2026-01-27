# Troubleshooting Guide

## Les mises à jour n’apparaissent pas chez un autre utilisateur / testeur

### Problème
Quand une personne crée une équipe, un match, un tournoi, etc., un autre utilisateur (par ex. un testeur ailleurs) ne voit pas ces changements.

### Comportement actuel
L’app **rafraîchit automatiquement** les données tant qu’elle est **au premier plan** (écran ouvert) :
- **Équipes, matchs, tournois** : rafraîchis environ toutes les **15 secondes**
- **Utilisateurs** (liste pour recherche joueur, etc.) : environ toutes les **30 secondes**
- **Chat** : déjà rafraîchi environ toutes les 5 secondes
- **Notifications** : déjà rafraîchies environ toutes les 3 secondes

Dès que l’app est en arrière-plan ou fermée, le rafraîchissement s’arrête (pour économiser batterie et données).

### À expliquer au testeur
1. **Garder l’écran concerné ouvert** (ex. onglet Équipes ou Matchs) pour que le rafraîchissement tourne.
2. **Attendre 15–30 secondes** après la création côté autre utilisateur : les nouvelles équipes / matchs / tournois apparaîtront sans rien faire.
3. **Revenir sur l’écran** (ex. quitter une modal puis revenir sur la liste) ou **rouvrir l’app** : un refetch a lieu, les données à jour s’affichent.

### Si ça ne suffit pas
- Vérifier que les **deux appareils** utilisent la **même source de données** (même projet Supabase, même backend si vous en avez un).
- Vérifier la **connexion internet** du testeur.
- Sur les listes qui le permettent, utiliser le **tirer pour rafraîchir** (pull-to-refresh) s’il est en place.

---

## ERR_NGROK_3200: Ngrok Tunnel Offline

### Error Message
```
HTTP response error 404: The endpoint qubgvsc-anonymous-8081.exp.direct is offline.
ERR_NGROK_3200
```

### What This Means
This error occurs when your app is trying to connect to an ngrok tunnel endpoint that is no longer active. Ngrok tunnels are temporary and expire when:
- The development server is stopped
- The tunnel connection is lost
- The tunnel session expires

### Solutions

#### Option 1: Restart Development Server (Recommended)
Restart your development server to create a new tunnel:

```bash
# Stop the current server (Ctrl+C), then:
bun run start
# or
bun run start-web
```

The `--tunnel` flag in your package.json scripts will automatically create a new ngrok tunnel.

#### Option 2: Use Production/Staging URL
If you want to connect to a stable backend without using tunnels, set the environment variable:

**Windows (PowerShell):**
```powershell
$env:EXPO_PUBLIC_RORK_API_BASE_URL="https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev"
bun run start
```

**Windows (CMD):**
```cmd
set EXPO_PUBLIC_RORK_API_BASE_URL=https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev
bun run start
```

**macOS/Linux:**
```bash
export EXPO_PUBLIC_RORK_API_BASE_URL=https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev
bun run start
```

#### Option 3: Create .env File
Create a `.env` file in the project root:

```env
EXPO_PUBLIC_RORK_API_BASE_URL=https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev
```

Then restart your development server.

### Verify Your Configuration

Check if the environment variable is set correctly:

**Windows (PowerShell):**
```powershell
echo $env:EXPO_PUBLIC_RORK_API_BASE_URL
```

**macOS/Linux:**
```bash
echo $EXPO_PUBLIC_RORK_API_BASE_URL
```

### Testing Backend Connectivity

Use the diagnostic script to test your backend connection:

```bash
# Windows (Git Bash or WSL)
bash diagnose-backend.sh

# Or manually test with curl
curl https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev/api/health
```

### Common Issues

1. **Tunnel URL cached in app**: Clear your app cache or restart the app completely
2. **Multiple tunnel processes**: Make sure only one development server is running
3. **Firewall blocking ngrok**: Check if your firewall is blocking ngrok connections
4. **Network issues**: Ensure you have a stable internet connection

### Need More Help?

- Check the [Expo documentation on tunnels](https://docs.expo.dev/more/development-builds/use-tunnels/)
- Review the [ngrok documentation](https://ngrok.com/docs)
- Check your Rork project dashboard for backend status

---

## HTTP 404: "Cannot GET /node_modules/..."

### What you might see

```
HTTP response error 404: <!DOCTYPE html>...
<pre>Cannot GET /node_modules/e...(truncated)...%22%7D</pre>
```

### Causes

1. **Source maps in DevTools**  
   The browser (or React Native DevTools) tries to load source maps from paths like `webpack:///node_modules/...` or `/node_modules/...`. The dev server doesn’t serve `node_modules`, so it returns 404. This is very common in web dev and usually **does not break the app**.

2. **Wrong API base URL**  
   If `EXPO_PUBLIC_RORK_API_BASE_URL` is set to a path or to a value that contains `node_modules`, the app might send API requests to the wrong URL and get that HTML 404.

### What to do

- **If the app still works**  
  You can ignore these 404s. To reduce noise:
  - In Chrome DevTools: Settings → Ignore list, and optionally uncheck `/node_modules/` so source map warnings are fewer.
  - Or run with source maps disabled in your bundler if you don’t need them.

- **If the app fails (e.g. login/API broken)**  
  - Set `EXPO_PUBLIC_RORK_API_BASE_URL` to a plain **origin only**, e.g. `http://localhost:3000` or `https://your-backend.example.com`, with **no path** and no `node_modules` in the value.
  - Restart the dev server after changing `.env`.
  - The app uses that value as the API origin (scheme + host + port) and appends `/api/trpc` and `/api/auth/...` itself.


