# Comment appliquer la migration avec Supabase CLI

## Option 1 : Via le Dashboard Supabase (Recommandé - le plus simple)

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Dans le menu de gauche, cliquez sur **"SQL Editor"**
4. Cliquez sur **"+ New Query"**
5. Copiez-collez le contenu du fichier : `supabase/migrations/20251208_push_subscriptions.sql`
6. Cliquez sur **"Run"** (ou Ctrl+Enter)
7. Vérifiez qu'il n'y a pas d'erreur

✅ C'est terminé ! La table `push_subscriptions` est créée.

## Option 2 : Avec Supabase CLI

Si vous avez installé Supabase CLI localement :

```bash
# 1. Vérifier que vous êtes connecté
supabase login

# 2. Lier votre projet local à votre projet Supabase
supabase link --project-ref votre-project-ref

# 3. Appliquer toutes les migrations
supabase db push
```

**Note :** Votre `project-ref` se trouve dans l'URL de votre dashboard :
`https://supabase.com/dashboard/project/[ICI-PROJECT-REF]`

## Option 3 : Migration manuelle (si vous n'avez pas accès au CLI)

Si vous n'avez pas accès à Supabase CLI et que vous voulez juste tester rapidement :

### SQL à exécuter dans le Dashboard :

```sql
-- Table pour stocker les abonnements push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER set_push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Activer RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies RLS
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

## Vérification

Après avoir exécuté la migration, vérifiez que tout fonctionne :

```sql
-- Vérifier que la table existe
SELECT * FROM push_subscriptions LIMIT 1;

-- Vérifier les RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'push_subscriptions';
```

Si aucune erreur n'apparaît, c'est bon ! ✅

## Vous avez déjà exécuté le SQL ?

Si vous avez déjà copié-collé le SQL dans Supabase Dashboard (comme vous l'avez mentionné), alors **la migration est déjà faite** ! 

Vous pouvez passer directement à l'étape suivante :
```bash
npm run dev
```

Puis testez le bouton "Activer les rappels" dans l'application.
