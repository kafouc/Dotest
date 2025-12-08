# Guide de Configuration - Système de Quiz en Temps Réel

## 📋 Vue d'ensemble

Le système de quiz en temps réel permet aux professeurs de :
- ✅ Partager un quiz via QR code
- ✅ Suivre les participants en temps réel
- ✅ Voir les réponses instantanément
- ✅ Obtenir des statistiques par question

Les élèves peuvent :
- ✅ Rejoindre sans compte (juste un pseudo)
- ✅ Répondre aux questions en direct
- ✅ Voir leur score final

## 🚀 Étapes d'installation

### 1. Exécuter la migration SQL

Ouvrez votre dashboard Supabase :
1. Allez dans **SQL Editor**
2. Cliquez sur **New Query**
3. Copiez-collez le contenu de `supabase/migrations/20251106_live_quiz_system.sql`
4. Cliquez sur **Run**

Vérifiez que les tables sont créées :
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers');
```

### 2. Activer Realtime

Dans votre dashboard Supabase :
1. Allez dans **Database** → **Replication**
2. Vérifiez que les tables suivantes sont activées pour Realtime :
   - `quiz_sessions`
   - `session_participants`
   - `live_answers`
3. Si non activées, cochez-les et cliquez sur **Save**

### 3. Vérifier les politiques RLS

Exécutez cette requête pour vérifier les politiques :
```sql
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers');
```

Vous devriez voir plusieurs politiques pour chaque table.

## 🧪 Test du système

### Test 1 : Générer et partager un quiz

1. Connectez-vous à l'application
2. Uploadez un document et attendez l'analyse
3. Générez un quiz
4. Cliquez sur **"Partager en temps réel"** 📱
5. Un QR code et un code à 6 caractères devraient s'afficher

### Test 2 : Rejoindre en tant qu'élève

1. Ouvrez une fenêtre en navigation privée
2. Allez sur `http://localhost:3000/join`
3. Entrez le code à 6 caractères
4. Entrez un pseudo
5. Vérifiez que vous voyez "En attente du démarrage..."

### Test 3 : Dashboard prof

1. Dans la fenêtre du prof, cliquez sur **"Ouvrir le Dashboard"**
2. Vérifiez que vous voyez le participant dans la liste
3. Cliquez sur **"Démarrer le Quiz"**
4. Retournez à la fenêtre élève → les questions devraient apparaître

### Test 4 : Réponses en temps réel

1. Dans la fenêtre élève, répondez aux questions
2. Dans le dashboard prof, vérifiez que les réponses apparaissent instantanément
3. Complétez le quiz
4. Vérifiez les statistiques dans le dashboard

## 🔧 Architecture

### Tables créées

1. **shared_quizzes** : Quiz partagés par les profs
   - `share_code` : Code unique à 6 caractères
   - `questions` : JSONB contenant les questions

2. **quiz_sessions** : Sessions de quiz actives
   - `status` : waiting | active | completed
   - Relation → shared_quizzes

3. **session_participants** : Participants anonymes
   - `nickname` : Pseudo de l'élève
   - Pas besoin de compte utilisateur

4. **live_answers** : Réponses en temps réel
   - Enregistre chaque réponse avec is_correct
   - Relation → participants

### Sécurité (RLS)

- **Profs** : Peuvent créer des quiz et gérer leurs sessions
- **Élèves** : Peuvent rejoindre les quiz actifs et soumettre des réponses
- **Isolation** : Chaque session est isolée
- **Anonymat** : Les élèves n'ont pas besoin de compte

### Realtime

Les updates en temps réel fonctionnent via Supabase Realtime :
- Dashboard prof écoute les nouveaux participants et réponses
- Page élève écoute le statut de la session
- Pas de polling, notifications instantanées

## 🐛 Dépannage

### Erreur "Cannot read from shared_quizzes"

→ Vérifiez que la migration SQL a été exécutée avec succès

### Les participants n'apparaissent pas

→ Vérifiez que Realtime est activé pour `session_participants`

### "Session introuvable"

→ Le prof doit d'abord créer une session en cliquant sur "Partager en temps réel"

### Les réponses ne s'affichent pas

→ Vérifiez que Realtime est activé pour `live_answers`

## 📊 Fichiers créés

### Base de données
- `supabase/migrations/20251106_live_quiz_system.sql`

### API
- `lib/liveQuiz.ts` (10 fonctions d'API)

### Composants
- `components/ShareQuizButton.tsx` (Bouton partage + QR code)

### Pages
- `app/join/page.tsx` (Entrée code)
- `app/join/[code]/page.tsx` (Participation élève)
- `app/live-dashboard/[sessionId]/page.tsx` (Dashboard prof)

### Modifications
- `components/QuizGenerator.tsx` (Intégration du bouton partage)

## 🎯 Prochaines étapes possibles

1. **Timer par question** : Ajouter une limite de temps
2. **Kick participant** : Retirer un élève
3. **Mode reveal** : Afficher les bonnes réponses ensemble
4. **Export CSV** : Télécharger les résultats
5. **Classement** : Leaderboard en temps réel
6. **Questions bonus** : Points supplémentaires
7. **Mode équipe** : Groupes d'élèves

## 💡 Utilisation recommandée

### En classe
1. Projetez le QR code au tableau
2. Les élèves scannent avec leur téléphone
3. Démarrez le quiz quand tout le monde est prêt
4. Suivez la progression en temps réel

### À distance
1. Partagez le code via le chat
2. Les élèves rejoignent depuis chez eux
3. Lancez le quiz à l'heure prévue
4. Consultez les statistiques après

---

**Besoin d'aide ?** Vérifiez d'abord que :
- ✅ La migration SQL est exécutée
- ✅ Realtime est activé
- ✅ Les variables d'environnement Supabase sont correctes
