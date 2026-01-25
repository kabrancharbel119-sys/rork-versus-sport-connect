#!/bin/bash

# =====================================================
# VS Sport App - Script d'Export Complet
# =====================================================

OUTPUT_DIR="vs-sport-app-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo "🔍 VS SPORT APP - EXPORT COMPLET"
echo "================================="
echo ""
echo "📁 Dossier de sortie: $OUTPUT_DIR"
echo ""

# 1. STRUCTURE DU PROJET
echo "📋 1. Extraction de la structure du projet..."
find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.expo/*" | sort > "$OUTPUT_DIR/project-structure.txt"
echo "✅ Structure sauvegardée"

# 2. FICHIERS DE CONFIGURATION
echo "⚙️  2. Copie des fichiers de configuration..."
cp package.json "$OUTPUT_DIR/" 2>/dev/null
cp tsconfig.json "$OUTPUT_DIR/" 2>/dev/null
cp app.json "$OUTPUT_DIR/" 2>/dev/null
cp metro.config.js "$OUTPUT_DIR/" 2>/dev/null
cp babel.config.js "$OUTPUT_DIR/" 2>/dev/null
echo "✅ Fichiers de config copiés"

# 3. SCHEMA SUPABASE
echo "🗄️  3. Copie du schéma Supabase..."
cp supabase-schema.sql "$OUTPUT_DIR/" 2>/dev/null || echo "⚠️  supabase-schema.sql non trouvé"
echo "✅ Schéma Supabase copié"

# 4. CODE SOURCE
echo "💻 4. Export du code source..."
mkdir -p "$OUTPUT_DIR/app"
mkdir -p "$OUTPUT_DIR/components"
mkdir -p "$OUTPUT_DIR/contexts"
mkdir -p "$OUTPUT_DIR/lib"
mkdir -p "$OUTPUT_DIR/types"
mkdir -p "$OUTPUT_DIR/constants"
mkdir -p "$OUTPUT_DIR/mocks"
mkdir -p "$OUTPUT_DIR/backend"

cp -r app/* "$OUTPUT_DIR/app/" 2>/dev/null
cp -r components/* "$OUTPUT_DIR/components/" 2>/dev/null
cp -r contexts/* "$OUTPUT_DIR/contexts/" 2>/dev/null
cp -r lib/* "$OUTPUT_DIR/lib/" 2>/dev/null
cp -r types/* "$OUTPUT_DIR/types/" 2>/dev/null
cp -r constants/* "$OUTPUT_DIR/constants/" 2>/dev/null
cp -r mocks/* "$OUTPUT_DIR/mocks/" 2>/dev/null
cp -r backend/* "$OUTPUT_DIR/backend/" 2>/dev/null
echo "✅ Code source copié"

# 5. COMPRESSION
echo "📦 5. Compression de l'export..."
tar -czf "$OUTPUT_DIR.tar.gz" "$OUTPUT_DIR" 2>/dev/null && {
    echo "✅ Archive créée: $OUTPUT_DIR.tar.gz"
} || {
    echo "⚠️  Impossible de créer l'archive"
}

# RÉSUMÉ FINAL
echo ""
echo "========================================"
echo "✅ EXPORT TERMINÉ !"
echo "========================================"
echo ""
echo "📁 Dossier: $OUTPUT_DIR"
echo "📦 Archive: $OUTPUT_DIR.tar.gz"
echo ""
