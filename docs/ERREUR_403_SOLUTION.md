# 🚨 Solution pour l'erreur 403

## Erreur Actuelle

```
Failed to load resource: the server responded with a status of 403
azodrrhkjmfmpitptecl.supabase.co/rest/v1/shared_quizzes
```

## Cause

La table `shared_quizzes` **n'existe pas** dans votre base de données Supabase.

## Solution (5 minutes)

### 📝 Étape 1 : Ouvrir Supabase SQL Editor

1. Allez sur : **https://supabase.com/dashboard**
2. Cliquez sur votre projet
3. Dans le menu de gauche, cliquez sur **SQL Editor** (icône </> )
4. Cliquez sur **"+ New Query"**

### 📋 Étape 2 : Copier la Migration

1. Ouvrez le fichier : `supabase/migrations/20251106_live_quiz_system.sql`
2. Sélectionnez **TOUT LE CONTENU** (Ctrl+A)
3. Copiez (Ctrl+C)

### ▶️ Étape 3 : Exécuter

1. Collez dans l'éditeur SQL de Supabase (Ctrl+V)
2. Cliquez sur **"Run"** en bas à droite (ou Ctrl+Enter)
3. Attendez 2-3 secondes

### ✅ Étape 4 : Vérifier

Vous devriez voir :
```
Success. No rows returned
```

Si vous voyez un message d'erreur, lisez-le attentivement :
- Si "already exists" → **C'est OK**, continuez
- Si "permission denied" → Vérifiez que vous êtes owner du projet
- Autre erreur → Copiez l'erreur et demandez de l'aide

### 🔍 Étape 5 : Tester avec DIAGNOSTIC.sql

1. Créez une **nouvelle query** dans SQL Editor
2. Copiez le contenu de `DIAGNOSTIC.sql`
3. Cliquez **"Run"**
4. Vérifiez que tous les tests affichent ✅ SUCCESS

### 🔄 Étape 6 : Activer Realtime

1. Dans Supabase Dashboard, cliquez sur **Database** → **Replication**
2. Trouvez ces 3 tables et **cochez-les** :
   - `quiz_sessions`
   - `session_participants`
   - `live_answers`
3. Cliquez sur **"Save"** en bas

### 🎉 Étape 7 : Retester l'Application

1. Retournez dans votre application
2. Rechargez la page complètement (Ctrl+Shift+R)
3. Connectez-vous si nécessaire
4. Générez un quiz
5. Cliquez sur **"Partager en temps réel"**

**Résultat attendu :**
- ✅ Une modale s'ouvre
- ✅ Un QR code s'affiche
- ✅ Un code à 6 caractères apparaît (ex: ABC123)
- ✅ Pas d'erreur 403 dans la console

---

## Toujours une erreur ?

### Erreur persiste après migration

Si l'erreur 403 persiste **après** avoir exécuté la migration :

1. **Vérifiez que vous êtes connecté**
   - Déconnectez-vous et reconnectez-vous
   - Ouvrez la console (F12) → onglet Application → Local Storage
   - Vérifiez la présence de clés Supabase

2. **Vérifiez les variables d'environnement**
   ```bash
   # Dans .env.local :
   NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
   ```

3. **Redémarrez le serveur**
   ```bash
   # Arrêtez le serveur (Ctrl+C) puis :
   cd ia-quiz-app
   npm run dev
   ```

### Erreur de permission

Si vous voyez "permission denied" lors de la migration :

→ Vous n'êtes pas propriétaire du projet Supabase
→ Contactez le propriétaire pour qu'il exécute la migration

### Autres erreurs SQL

Si vous voyez des erreurs SQL complexes :

1. Copiez l'erreur complète
2. Exécutez d'abord `DIAGNOSTIC.sql` pour voir l'état actuel
3. Partagez les résultats pour diagnostic

---

## Aide Rapide

| Symptôme | Cause | Solution |
|----------|-------|----------|
| 403 Forbidden | Tables manquantes | Exécuter migration SQL |
| Null/undefined | Pas connecté | Se reconnecter |
| Code invalide | Code expiré/inexistant | Regénérer le partage |
| QR code ne s'affiche pas | Erreur JS | Vérifier console F12 |

---

## Fichiers de Référence

- `20251106_live_quiz_system.sql` → Migration complète
- `DIAGNOSTIC.sql` → Script de test automatique
- `MIGRATION_CHECK.sql` → Vérification détaillée
- `QUICK_START.md` → Guide complet
- `LIVE_QUIZ_SETUP.md` → Documentation technique

---

**Temps estimé** : 5 minutes  
**Difficulté** : Facile (copier-coller)  
**Prérequis** : Accès au Dashboard Supabase
