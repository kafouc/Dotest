# ✅ Checklist de Configuration - Push Notifications

## Étape 1 : Clés VAPID ✅ FAIT

- [x] Clés VAPID générées
- [x] Fichier `.env.local` créé avec les clés
- [x] `.env.local` ajouté au `.gitignore`
- [x] Clés publique et privée configurées

**Clé publique :** `BFo6KDTwb16drLvId7rQn7y1BOPh3vlWEcrQ7x7rPHqNlFQL2Pm2nRCZhKWC1Ze_VDunncwBl08zfZPbyJ1AqYo`

## Étape 2 : Migration Supabase ⚠️ À VÉRIFIER

Vous avez mentionné avoir déjà exécuté le SQL. Vérifiez :

### Dans Supabase Dashboard > SQL Editor :

```sql
SELECT * FROM push_subscriptions LIMIT 1;
```

**Résultats attendus :**
- ✅ Pas d'erreur = Table existe, passez à l'étape 3
- ❌ Erreur "relation does not exist" = Exécutez le SQL ci-dessous

### Si la table n'existe pas, exécutez ce SQL :

```sql
-- Copier-coller dans SQL Editor de Supabase Dashboard

CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
ON push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
ON push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);
```

## Étape 3 : Démarrage de l'application ✅ FAIT

- [x] Serveur Next.js démarré
- [x] Aucune erreur de compilation
- [x] Application disponible sur http://localhost:3000

**Statut :** ✓ Ready in 1919ms

## Étape 4 : Test des notifications ⏳ À FAIRE

### Actions à réaliser :

1. **Ouvrir l'application**
   - URL : http://localhost:3000/app
   - Se connecter si nécessaire

2. **Sélectionner un document**
   - Choisir un document PDF dans la liste
   - Attendre que le document soit chargé

3. **Activer les notifications**
   - Cliquer sur le bouton 🔔 **"Activer les rappels"**
   - Le navigateur devrait demander la permission
   - Cliquer sur **"Autoriser"**

4. **Vérifier le succès**
   - Un message "Rappels activés !" devrait apparaître
   - Ouvrir la console navigateur (F12) pour vérifier qu'il n'y a pas d'erreur

### Vérification dans Supabase :

```sql
SELECT user_id, endpoint, created_at 
FROM push_subscriptions 
ORDER BY created_at DESC 
LIMIT 5;
```

**Vous devriez voir :** Votre abonnement avec l'endpoint du navigateur.

## Étape 5 : Vérifications techniques ⏳ OPTIONNEL

### Service Worker enregistré ?

1. Ouvrir DevTools (F12)
2. Aller dans l'onglet **Application**
3. Section **Service Workers**
4. Vérifier que `/sw.js` est **activated and is running**

### Subscription Push enregistrée ?

Dans DevTools > Application > Storage > Cache Storage :
- Vérifier la présence de l'abonnement push

### Console navigateur sans erreurs ?

Vérifier qu'il n'y a pas d'erreur liée à :
- VAPID key
- Service Worker
- Push Manager
- Permissions

## 📊 Résumé de l'état actuel

| Composant | Statut | Notes |
|-----------|--------|-------|
| Clés VAPID | ✅ Configuré | Dans .env.local |
| Table Supabase | ⚠️ À vérifier | Vous avez dit l'avoir créée |
| API Subscribe | ✅ OK | /api/push/subscribe |
| Service Worker | ✅ OK | public/sw.js |
| Push Manager | ✅ OK | lib/pushManager.ts |
| Bouton UI | ✅ OK | Dans app/app/page.tsx |
| RLS Policies | ✅ OK | Dans la migration |
| .gitignore | ✅ OK | .env.local protégé |
| Serveur Next.js | ✅ Running | Port 3000 |

## 🎯 Prochaines étapes après test réussi

Une fois que les notifications sont activées avec succès :

### 1. Persister les données FSRS
- Créer la table `card_reviews` dans Supabase
- Modifier `QuizAttempt.tsx` pour sauvegarder les états FSRS
- Afficher "Prochaine révision : [date]" dans l'UI

### 2. Envoyer des notifications
- Installer `web-push` : `npm install web-push`
- Créer `/api/push/notify` pour envoyer des notifications
- Implémenter un cron job pour rappels quotidiens

### 3. Améliorer l'expérience
- Permettre de désactiver les notifications
- Afficher l'état de l'abonnement dans l'UI
- Personnaliser les messages de notification

## 📁 Documentation disponible

- `QUICK_SETUP_VAPID.md` - Guide rapide
- `VAPID_CONFIG_GUIDE.md` - Guide complet
- `MIGRATION_SUPABASE_GUIDE.md` - Guide migration DB
- `VAPID_SETUP_STATUS.txt` - Récapitulatif visuel
- `.env.local.example` - Modèle de configuration
- `setup-vapid.sh` - Script de configuration automatique

---

**Dernier test effectué :** ${new Date().toLocaleString('fr-FR')}
**Serveur :** ✓ Running sur http://localhost:3000
**Prochaine action :** Tester le bouton "Activer les rappels" dans l'app
