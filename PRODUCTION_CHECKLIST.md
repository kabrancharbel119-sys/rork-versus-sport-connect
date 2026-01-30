# Checklist production – VS Sport Connect

À valider avant la mise en production (App Store / Google Play ou déploiement web).

---

## 1. Auth et sécurité

| Action | Statut | Détail |
|--------|--------|--------|
| Auth backend activée | ⬜ | Mettre `EXPO_PUBLIC_USE_BACKEND_AUTH=true` et déployer le backend avec `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. L’app utilisera `POST /api/auth/login` et `POST /api/auth/register` (pas de `password_hash` côté client). |
| URL d’API stable | ✅ | `EXPO_PUBLIC_RORK_API_BASE_URL` est défini en production dans `eas.json` (ex. `https://api.rork.com`). Adapter l’URL si votre backend est hébergé ailleurs, ou utiliser EAS Secrets. |
| RLS Supabase | ⬜ | Les politiques actuelles sont permissives (`USING (true)`). Voir `supabase-rls-production.sql` et la section « RLS » plus bas. À appliquer quand vous utilisez Supabase Auth ou un backend qui fait toutes les écritures. |
| CORS | ⬜ | Sur le backend, définir `ALLOWED_ORIGINS` (ex. `https://votredomaine.com,https://app.votredomaine.com`) pour limiter les origines en production. |

---

## 2. CGU et confidentialité (stores)

| Action | Statut | Détail |
|--------|--------|--------|
| URLs web Terms / Privacy | ✅ | `app.json` pointe vers `https://rork.com/privacy` et `https://rork.com/terms`. Les pages HTML sont dans `legal-pages/` (voir `legal-pages/README.md`) : à déployer sur rork.com (Vercel ou autre). |
| Contenu à jour | ⬜ | Vérifier que le contenu des écrans in-app Terms et Privacy correspond aux documents hébergés et à la loi (RGPD, âge minimal, etc.). Les fichiers `legal-pages/privacy/index.html` et `legal-pages/terms/index.html` sont alignés sur les écrans. |

---

## 3. Crash reporting et observabilité

| Action | Statut | Détail |
|--------|--------|--------|
| Sentry (ou équivalent) | ⬜ | Si `EXPO_PUBLIC_SENTRY_DSN` est défini, l’app envoie les erreurs à Sentry. Créer un projet sur [sentry.io](https://sentry.io), récupérer le DSN et l’ajouter dans les variables d’environnement de build (EAS Secrets ou équivalent). |
| Monitoring backend | ⬜ | Logs, métriques et alertes sur le serveur qui héberge le backend (Hono / auth). |

---

## 4. Build et déploiement

| Action | Statut | Détail |
|--------|--------|--------|
| `eas.json` | ✅ | Profils `development`, `preview`, `production` déjà présents. Vérifier les env (ex. `EXPO_PUBLIC_USE_BACKEND_AUTH=true` en production). |
| Variables d’environnement | ✅ | En production dans `eas.json` : `EXPO_PUBLIC_USE_BACKEND_AUTH`, `EXPO_PUBLIC_RORK_API_BASE_URL`, Supabase. Pour plus de sécurité, préférer **EAS Secrets** pour les clés sensibles : `eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."`. |
| Backend déployé | ⬜ | Héberger le backend (dans `backend/`) à l’URL utilisée par `EXPO_PUBLIC_RORK_API_BASE_URL` (ex. `https://api.rork.com`). Sur ce serveur : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, et optionnellement `RESEND_API_KEY`, `ALLOWED_ORIGINS` (ex. `https://rork.com`). |

---

## 5. RLS Supabase (quand vous êtes prêts)

Aujourd’hui l’app parle à Supabase avec la clé **anon** et des politiques permissives. Pour sécuriser en production vous avez deux options :

- **Option A – Tout passer par le backend**  
  L’app n’appelle plus Supabase que en lecture (ou pas du tout) ; toutes les écritures passent par votre backend (service_role). Vous pouvez alors restreindre l’anon en **lecture seule** sur les tables nécessaires (voir `supabase-rls-production.sql` pour des exemples).

- **Option B – Supabase Auth**  
  Utiliser Supabase Auth (magic link, OTP, etc.) et identifier l’utilisateur côté Supabase. Les politiques RLS peuvent alors utiliser `auth.uid()`. Le fichier `supabase-rls-production.sql` donne des exemples de politiques basées sur `auth.uid()` à adapter à votre schéma.

Dans les deux cas, **ne pas appliquer** des RLS restrictives tant que l’app ou le backend n’est pas adapté, sinon des fonctionnalités casseront.

---

## 6. CI/CD

| Action | Statut | Détail |
|--------|--------|--------|
| Tests sur chaque push/PR | ✅ | Un workflow GitHub Actions exécute `npm run test` (voir `.github/workflows/test.yml`). À activer si le dépôt est sur GitHub. |

---

## 7. Dernières vérifications

- [ ] Tester un build EAS production : `eas build --profile production --platform ios` (et android si besoin).
- [ ] Tester le flux complet : inscription, connexion, création équipe/match, notifications, etc.
- [ ] Vérifier que les clés API (Supabase, Resend, Sentry) ne sont jamais committées (tout dans `.env` / EAS Secrets / variables d’environnement du serveur).

---

## Fichiers utiles

- `.env.example` – liste des variables d’environnement.
- `eas.json` – profils de build EAS (production inclut `EXPO_PUBLIC_RORK_API_BASE_URL`).
- `legal-pages/` – pages web Privacy et Terms à déployer sur rork.com ; voir `legal-pages/README.md`.
- `supabase-rls-production.sql` – exemples de politiques RLS pour une future mise en production.
- `PRODUCTION_CHECKLIST.md` – ce fichier.
