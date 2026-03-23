# Play Store Release Checklist (Android)

## 1) Préparation projet

- Vérifier la config Expo/EAS :
  - `app.json` : `expo.android.package`, `expo.android.versionCode`, icônes Android
  - `eas.json` : profil `build.production` avec `android.buildType = "app-bundle"`
- Vérifier le backend production : `EXPO_PUBLIC_RORK_API_BASE_URL`
- Vérifier la politique de confidentialité et les CGU (URLs accessibles publiquement)

## 2) Préparation compte Google Play

- Créer l’application dans Google Play Console
- Compléter :
  - Nom de l’app
  - Description courte + longue
  - Captures d’écran
  - Icône 512x512
  - Graphic feature 1024x500
  - Catégorie + contact support
  - Politique de confidentialité
- Compléter les formulaires :
  - Data safety
  - Content rating
  - Target audience
  - App access (si besoin)

## 3) Build Android AAB

- Connexion Expo : `eas login`
- Build production :
  - `npm run build:android:prod`

## 4) Signature et upload

- Laisser EAS gérer la keystore (recommandé)
- Soumettre automatiquement :
  - `npm run submit:android:prod`
- Ou upload manuel du `.aab` depuis Google Play Console

## 5) Lancement sécurisé

- Démarrer sur la piste `internal` ou `closed testing`
- Vérifier :
  - ouverture app
  - login/signup
  - navigation principale
  - paiements / fonctionnalités critiques
  - crash-free sessions
- Puis promouvoir en production

## 6) À faire avant le clic "Publier"

- Incrément de version validé (`autoIncrement` activé dans `eas.json`)
- Permissions Android minimales et justifiées
- Liens légaux publics et valides
- Test réel sur appareil Android release
- Notes de version prêtes

## Commandes utiles

- Vérification TypeScript : `npx tsc --noEmit`
- Build Android prod : `npm run build:android:prod`
- Submit Android prod : `npm run submit:android:prod`
