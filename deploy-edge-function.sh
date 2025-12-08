#!/bin/bash

echo "=== Déploiement de la fonction Edge embed-worker ==="
echo ""

# Vérifier si déjà connecté
if supabase projects list &>/dev/null; then
    echo "✓ Déjà authentifié à Supabase"
else
    echo "Étape 1: Authentification Supabase"
    echo "----------------------------------------"
    echo "1. Allez sur: https://supabase.com/dashboard/account/tokens"
    echo "2. Générez un 'Access Token' si nécessaire"
    echo "3. Copiez le token"
    echo ""
    read -p "Collez votre Access Token ici: " SUPABASE_TOKEN
    echo ""
    
    # Login avec token
    export SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN"
fi

echo ""
echo "Étape 2: Lier le projet"
echo "----------------------------------------"
read -p "Entrez votre Project Ref (ex: azodrrhkjmfmpitptecl): " PROJECT_REF
echo ""

supabase link --project-ref "$PROJECT_REF"

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la liaison du projet"
    exit 1
fi

echo ""
echo "Étape 3: Déploiement de embed-worker"
echo "----------------------------------------"

supabase functions deploy embed-worker --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Fonction déployée avec succès!"
    echo ""
    echo "Vous pouvez maintenant tester l'upload de fichiers .docx et .pptx"
else
    echo ""
    echo "❌ Erreur lors du déploiement"
    exit 1
fi
