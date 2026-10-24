#!/bin/bash
# Script pour générer les icônes PWA à partir du logo SVG

echo "🎨 Génération des icônes PWA..."

# Vérifier si ImageMagick est installé
if ! command -v convert &> /dev/null; then
    echo "⚠️  ImageMagick n'est pas installé. Installation..."
    sudo apt-get update && sudo apt-get install -y imagemagick
fi

# Source SVG
SVG_SOURCE="public/brand/logo/paper_logo.svg"
OUTPUT_DIR="public/icons"

# Créer le dossier de sortie s'il n'existe pas
mkdir -p "$OUTPUT_DIR"

# Tailles d'icônes nécessaires pour PWA
SIZES=(16 32 72 96 128 144 152 192 384 512)

echo "📦 Génération des icônes aux différentes tailles..."

for size in "${SIZES[@]}"; do
    echo "  → Génération icon-${size}x${size}.png"
    convert -background none -resize "${size}x${size}" "$SVG_SOURCE" "$OUTPUT_DIR/icon-${size}x${size}.png"
done

echo "✅ Toutes les icônes ont été générées dans $OUTPUT_DIR"
echo ""
echo "📋 Icônes créées:"
ls -lh "$OUTPUT_DIR"
