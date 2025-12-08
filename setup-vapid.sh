#!/bin/bash
# Script de configuration VAPID pour les notifications push

set -e

echo "🔐 Configuration des clés VAPID pour les notifications push"
echo "==========================================================="
echo ""

# Vérifier si .env.local existe
if [ -f .env.local ]; then
  echo "✓ Fichier .env.local trouvé"
  
  # Vérifier si les clés VAPID existent déjà
  if grep -q "NEXT_PUBLIC_VAPID_PUBLIC_KEY" .env.local && grep -q "VAPID_PRIVATE_KEY" .env.local; then
    echo "⚠️  Les clés VAPID semblent déjà configurées dans .env.local"
    echo ""
    read -p "Voulez-vous les régénérer ? (o/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
      echo "❌ Configuration annulée"
      exit 0
    fi
  fi
else
  echo "📝 Création du fichier .env.local..."
  touch .env.local
fi

echo ""
echo "🔑 Génération des clés VAPID..."
echo ""

# Générer les clés VAPID
VAPID_OUTPUT=$(npx -y web-push generate-vapid-keys)

# Extraire les clés
PUBLIC_KEY=$(echo "$VAPID_OUTPUT" | grep "Public Key:" | sed 's/Public Key: //')
PRIVATE_KEY=$(echo "$VAPID_OUTPUT" | grep "Private Key:" | sed 's/Private Key: //')

if [ -z "$PUBLIC_KEY" ] || [ -z "$PRIVATE_KEY" ]; then
  echo "❌ Erreur lors de la génération des clés VAPID"
  exit 1
fi

echo "✓ Clés générées avec succès !"
echo ""
echo "Public Key:  $PUBLIC_KEY"
echo "Private Key: ${PRIVATE_KEY:0:20}... (cachée pour sécurité)"
echo ""

# Supprimer les anciennes clés VAPID si elles existent
sed -i '/NEXT_PUBLIC_VAPID_PUBLIC_KEY/d' .env.local 2>/dev/null || true
sed -i '/VAPID_PRIVATE_KEY/d' .env.local 2>/dev/null || true

# Ajouter les nouvelles clés
echo "" >> .env.local
echo "# VAPID Keys pour Push Notifications" >> .env.local
echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$PUBLIC_KEY" >> .env.local
echo "VAPID_PRIVATE_KEY=$PRIVATE_KEY" >> .env.local

echo "✓ Clés ajoutées à .env.local"
echo ""
echo "🎉 Configuration terminée !"
echo ""
echo "📋 Prochaines étapes :"
echo "  1. Vérifiez que la table push_subscriptions existe dans Supabase"
echo "  2. Redémarrez votre serveur de développement : npm run dev"
echo "  3. Testez en cliquant sur 'Activer les rappels' dans l'app"
echo ""
echo "⚠️  N'oubliez pas :"
echo "  - Ne commitez JAMAIS le fichier .env.local dans Git !"
echo "  - Sauvegardez vos clés dans un endroit sécurisé"
echo ""
