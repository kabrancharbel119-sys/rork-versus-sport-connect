#!/bin/bash

# Script pour redémarrer le backend Rork
# Le backend se redéploie automatiquement quand un fichier backend est modifié

echo "🔄 Redémarrage du backend..."

# Ajoute un commentaire timestamp pour forcer le redéploiement
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
sed -i "s|// Backend restart:.*|// Backend restart: $TIMESTAMP|" backend/hono.ts 2>/dev/null || \
  echo "// Backend restart: $TIMESTAMP" >> backend/hono.ts

echo "✅ Fichier backend modifié - le redéploiement devrait démarrer automatiquement"
echo "⏳ Attends environ 10-30 secondes pour que le backend soit prêt"
