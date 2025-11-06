# 🚀 Guide de Démarrage Rapide - Quiz Live

## ⚠️ ERREUR 403 sur shared_quizzes ?

Si vous voyez cette erreur :
```
Failed to load resource: the server responded with a status of 403
```

Cela signifie que **la migration SQL n'a pas été exécutée**. Suivez ces étapes :

---

## 📋 Installation en 3 Étapes

### ✅ Étape 1 : Exécuter la Migration SQL (OBLIGATOIRE)

1. Ouvrez votre **Dashboard Supabase** : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Dans le menu latéral, cliquez sur **SQL Editor**
4. Cliquez sur **"New Query"**
5. Copiez **TOUT** le contenu du fichier `supabase/migrations/20251106_live_quiz_system.sql`
6. Collez dans l'éditeur
7. Cliquez sur **"Run"** (ou Ctrl+Enter)

**✅ Vous devriez voir :** `Success. No rows returned`

---

### ✅ Étape 2 : Vérifier l'Installation

1. Dans le même **SQL Editor**, créez une nouvelle query
2. Copiez **TOUT** le contenu du fichier `MIGRATION_CHECK.sql`
3. Cliquez sur **"Run"**

**✅ Résultats attendus :**
- **Tables** : 4 tables créées (shared_quizzes, quiz_sessions, session_participants, live_answers)
- **Politiques RLS** : Au moins 12 politiques visibles
- **RLS activé** : `rls_enabled = true` pour toutes les tables
- **Realtime** : Les 4 tables dans `supabase_realtime`
- **Fonction** : `generate_share_code` existe
- **Trigger** : `set_share_code_trigger` existe

❌ **Si des éléments manquent**, répétez l'Étape 1.

---

### ✅ Étape 3 : Activer Realtime (OBLIGATOIRE)

1. Dans le Dashboard Supabase, allez dans **Database** → **Replication**
2. Cherchez ces 4 tables et **activez-les** (cochez la case) :
   - ✅ `quiz_sessions`
   - ✅ `session_participants`
   - ✅ `live_answers`
   - ✅ `shared_quizzes` (optionnel mais recommandé)
3. Cliquez sur **"Save"** en bas de page

---

## 🧪 Test de Fonctionnement

### Test Rapide

1. **Connectez-vous** à l'application
2. **Uploadez un document** (PDF) et attendez l'analyse
3. **Générez un quiz** (5 questions par exemple)
4. Cliquez sur **"Partager en temps réel"** 📱

**✅ Si ça marche :**
- Une modale s'ouvre avec un QR code
- Un code à 6 caractères s'affiche (ex: ABC123)
- Pas d'erreur 403 dans la console

**❌ Si erreur 403 :**
- Retournez à l'Étape 1 (migration SQL)
- Vérifiez les logs dans la console navigateur

---

## 🔍 Dépannage Détaillé

### Erreur : "Failed to load resource: 403"

**Cause :** Les tables `shared_quizzes`, `quiz_sessions`, etc. n'existent pas ou les politiques RLS bloquent l'accès.

**Solution :**
```sql
-- Exécutez dans SQL Editor pour voir les tables :
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%quiz%' OR table_name LIKE '%session%' OR table_name LIKE '%answer%';
```

Si les tables `shared_quizzes`, `quiz_sessions`, `session_participants`, `live_answers` n'apparaissent **PAS**, alors la migration n'a pas été exécutée.

---

### Erreur : "null" ou "undefined" lors du partage

**Cause :** L'utilisateur n'est pas connecté ou la session a expiré.

**Solution :**
- Déconnectez-vous et reconnectez-vous
- Vérifiez dans la console : `localStorage` doit contenir des clés Supabase

---

### Erreur : "Impossible de rejoindre"

**Cause :** Le code n'existe pas ou la session est terminée.

**Solution :**
- Vérifiez que le code est bien en majuscules (6 caractères)
- Vérifiez dans Supabase Table Editor → `shared_quizzes` que le code existe
- Le code est sensible à la casse

---

## 📊 Vérification Manuelle dans Supabase

### Voir les quiz partagés
```sql
SELECT id, title, share_code, created_at, creator_id 
FROM shared_quizzes 
ORDER BY created_at DESC 
LIMIT 10;
```

### Voir les sessions actives
```sql
SELECT s.id, s.status, s.created_at, q.title, q.share_code
FROM quiz_sessions s
JOIN shared_quizzes q ON s.shared_quiz_id = q.id
WHERE s.status IN ('waiting', 'active')
ORDER BY s.created_at DESC;
```

### Voir les participants
```sql
SELECT p.nickname, p.joined_at, s.status
FROM session_participants p
JOIN quiz_sessions s ON p.session_id = s.id
ORDER BY p.joined_at DESC
LIMIT 20;
```

### Voir les réponses
```sql
SELECT 
  p.nickname,
  a.question_index,
  a.answer,
  a.is_correct,
  a.submitted_at
FROM live_answers a
JOIN session_participants p ON a.participant_id = p.id
ORDER BY a.submitted_at DESC
LIMIT 50;
```

---

## 🎯 Checklist Complète

Avant de tester, assurez-vous que :

- [ ] **Migration SQL exécutée** (fichier `20251106_live_quiz_system.sql`)
- [ ] **4 tables créées** (vérifiez avec `MIGRATION_CHECK.sql`)
- [ ] **RLS activé** sur toutes les tables
- [ ] **Politiques RLS** créées (au moins 12)
- [ ] **Realtime activé** pour `quiz_sessions`, `session_participants`, `live_answers`
- [ ] **Variables d'environnement** correctes (`.env.local` avec SUPABASE_URL et ANON_KEY)
- [ ] **Utilisateur connecté** dans l'application
- [ ] **Build réussi** (`npm run build` sans erreur)

---

## 💡 Notes Importantes

### Sécurité
- Les **élèves n'ont PAS besoin de compte** (participation anonyme avec pseudo)
- Les **profs doivent être connectés** pour créer des quiz
- Les **politiques RLS** isolent les données par créateur

### Limitations
- Un élève **ne peut pas** rejoindre deux fois avec le même pseudo dans la même session
- Les sessions en statut **"completed"** ne peuvent plus recevoir de participants
- Les codes de partage sont **uniques** et **permanents** (pas de réutilisation)

### Performance
- Le **Realtime** fonctionne via WebSockets (vérifiez le firewall)
- Les **QR codes** sont générés côté client (pas de limite)
- Les **réponses** sont enregistrées instantanément (pas de cache)

---

## 🆘 Besoin d'Aide ?

1. **Vérifiez d'abord** `MIGRATION_CHECK.sql` pour diagnostiquer
2. **Consultez** la console navigateur (F12) pour les erreurs détaillées
3. **Vérifiez** les logs Supabase dans Dashboard → Logs
4. **Testez** les requêtes SQL manuellement dans SQL Editor

---

**Dernière mise à jour** : 6 novembre 2025
