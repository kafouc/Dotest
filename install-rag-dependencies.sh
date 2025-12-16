#!/bin/bash
# Script pour installer les dépendances nécessaires à la migration RAG

echo "🔧 Installation des dépendances pour la migration RAG vers Next.js..."

# Installer les dépendances pour l'extraction de texte
npm install unpdf mammoth jszip

echo "✅ Dépendances installées !"
echo ""
echo "📦 Dépendances ajoutées :"
echo "  - unpdf (extraction PDF)"
echo "  - mammoth (extraction DOCX)"
echo "  - jszip (extraction PPTX)"
echo ""
echo "🚀 Vous pouvez maintenant téléverser des PDFs de 500 pages (50 Mo max)"
