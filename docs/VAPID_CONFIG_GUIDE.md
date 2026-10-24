# Guide de configuration VAPID et Push Notifications

## ✅ Étape 1: Clés VAPID générées

Les clés VAPID ont été générées avec succès. Elles permettent d'authentifier vos notifications push.

**⚠️ IMPORTANT :** Gardez la clé privée secrète, ne la committez jamais dans Git !

## 📝 Étape 2: Configurer les variables d'environnement

Créez ou modifiez le fichier `.env.local` à la racine du projet :

```bash
# Clé publique VAPID (côté client)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=votre_clé_publique_ici

# Clé privée VAPID (côté serveur - GARDEZ-LA SECRÈTE !)
VAPID_PRIVATE_KEY=votre_clé_privée_ici
```

**Instructions:**
1. Copiez les clés VAPID générées dans le terminal (commande `npx web-push generate-vapid-keys`)
2. Collez la **clé publique** dans `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
3. Collez la **clé privée** dans `VAPID_PRIVATE_KEY`
4. Ajoutez `.env.local` à `.gitignore` (normalement déjà fait)

## 🗄️ Étape 3: Appliquer la migration Supabase

Vous avez dit avoir déjà appliqué le SQL dans Supabase. Vérifiez que la table existe :

```sql
SELECT * FROM push_subscriptions LIMIT 1;
```

Si la table n'existe pas, exécutez le SQL dans l'éditeur SQL de Supabase Dashboard :
- Fichier source : `supabase/migrations/20251208_push_subscriptions.sql`

**Alternative avec CLI Supabase:**
```bash
supabase db push
```

## 🚀 Étape 4: Redémarrer le serveur de développement

```bash
# Arrêter le serveur (Ctrl+C si en cours)
# Puis relancer :
npm run dev
```

## ✓ Étape 5: Tester les notifications

1. Ouvrez l'application dans votre navigateur
2. Sélectionnez un document
3. Cliquez sur le bouton **"Activer les rappels"** 🔔
4. Autorisez les notifications si demandé
5. Vérifiez dans la console du navigateur qu'il n'y a pas d'erreur
6. Vérifiez dans Supabase que l'abonnement est enregistré :
   ```sql
   SELECT * FROM push_subscriptions;
   ```

## 🔧 Prochaines étapes (optionnelles)

### Créer l'API d'envoi de notifications

Pour envoyer des notifications push aux utilisateurs :

1. Installer le package `web-push` :
   ```bash
   npm install web-push
   ```

2. Créer l'endpoint `/api/push/notify` (à implémenter)

3. Créer une tâche planifiée (cron) pour envoyer des rappels quotidiens

### Persister les données FSRS

Créer la table `card_reviews` pour stocker les états de révision espacée :

```sql
CREATE TABLE card_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_path TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  stability FLOAT NOT NULL DEFAULT 1.0,
  difficulty FLOAT NOT NULL DEFAULT 5.0,
  interval_days FLOAT NOT NULL DEFAULT 1.0,
  next_review_at TIMESTAMPTZ NOT NULL,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, document_path, question_index)
);

-- Index pour les requêtes de révision dues
CREATE INDEX idx_card_reviews_next_review 
ON card_reviews(user_id, next_review_at) 
WHERE next_review_at <= NOW();

-- RLS policies
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reviews"
ON card_reviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reviews"
ON card_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
ON card_reviews FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER set_card_reviews_updated_at
BEFORE UPDATE ON card_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

## 📚 Ressources

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID Protocol](https://datatracker.ietf.org/doc/html/rfc8292)
- [web-push npm package](https://www.npmjs.com/package/web-push)
