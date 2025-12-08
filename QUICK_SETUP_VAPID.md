# Guide rapide : Migration Supabase et VAPID

## 🚀 Configuration rapide en 3 commandes

### 1. Configurer les clés VAPID
```bash
./setup-vapid.sh
```
Ce script va :
- Générer automatiquement les clés VAPID
- Les ajouter à votre fichier `.env.local`
- Vous guider pour les prochaines étapes

### 2. Appliquer la migration Supabase

**Option A : Via le Dashboard Supabase (recommandé si vous avez déjà exécuté le SQL)**
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur "SQL Editor"
4. Vérifiez que la table existe : `SELECT * FROM push_subscriptions LIMIT 1;`
5. Si la table existe déjà, passez à l'étape 3 !

**Option B : Via Supabase CLI**
```bash
# Si vous utilisez Supabase localement
supabase db push

# OU si vous voulez juste appliquer la migration spécifique
supabase db push supabase/migrations/20251208_push_subscriptions.sql
```

**Option C : Copier-coller le SQL dans le Dashboard**
Si la table n'existe pas encore, copiez le contenu du fichier :
`supabase/migrations/20251208_push_subscriptions.sql`

Et exécutez-le dans le SQL Editor de votre Dashboard Supabase.

### 3. Redémarrer l'application
```bash
npm run dev
```

## ✅ Vérification

### Vérifier que tout fonctionne :

1. **Les clés VAPID sont configurées :**
   ```bash
   grep VAPID .env.local
   ```
   Vous devriez voir les deux clés (publique et privée).

2. **La table Supabase existe :**
   Dans le SQL Editor de Supabase :
   ```sql
   SELECT * FROM push_subscriptions;
   ```
   Aucune erreur = la table existe ✓

3. **L'application démarre sans erreur :**
   ```bash
   npm run dev
   ```
   Aucune erreur dans la console ✓

4. **Tester les notifications :**
   - Ouvrez l'app : http://localhost:3000/app
   - Sélectionnez un document
   - Cliquez sur **"Activer les rappels"** 🔔
   - Autorisez les notifications si demandé
   - Vous devriez voir "Rappels activés !" ✓

5. **Vérifier l'abonnement dans Supabase :**
   ```sql
   SELECT user_id, endpoint, created_at 
   FROM push_subscriptions 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   Votre abonnement devrait apparaître ✓

## 🐛 Dépannage

### Erreur : "VAPID public key manquante"
- Vérifiez que `.env.local` contient `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Redémarrez le serveur (`npm run dev`)

### Erreur : "Table push_subscriptions n'existe pas"
- Exécutez la migration SQL dans Supabase Dashboard
- Vérifiez que vous êtes connecté au bon projet Supabase

### Erreur : "Permission denied"
- Vérifiez les RLS policies dans Supabase
- La migration devrait les créer automatiquement

### Les notifications ne fonctionnent pas
- Vérifiez que le Service Worker est enregistré (DevTools > Application > Service Workers)
- Vérifiez les permissions de notification dans votre navigateur
- Ouvrez la console du navigateur pour voir les erreurs

## 📖 Documentation complète

Pour plus de détails, consultez `VAPID_CONFIG_GUIDE.md`.
