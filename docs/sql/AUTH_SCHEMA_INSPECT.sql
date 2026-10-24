-- ============================================================
-- INSPECTION DU SCHÉMA D'AUTHENTIFICATION SUPABASE
-- Ce fichier contient des requêtes SÛRES pour inspecter
-- le schéma auth.* existant de votre base Supabase
-- ============================================================

-- ✅ CE FICHIER PEUT ÊTRE EXÉCUTÉ EN TOUTE SÉCURITÉ
-- Il contient uniquement des requêtes SELECT (lecture seule)

-- ============================================================
-- 1. LISTER TOUTES LES TABLES DU SCHÉMA auth
-- ============================================================

SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'auth'
ORDER BY table_name;


-- ============================================================
-- 2. STRUCTURE DE LA TABLE auth.users
-- ============================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'users'
ORDER BY ordinal_position;


-- ============================================================
-- 3. STRUCTURE DE LA TABLE auth.sessions
-- ============================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'sessions'
ORDER BY ordinal_position;


-- ============================================================
-- 4. STRUCTURE DE LA TABLE auth.identities
-- ============================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'identities'
ORDER BY ordinal_position;


-- ============================================================
-- 5. LISTER TOUS LES INDEX DU SCHÉMA auth
-- ============================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'auth'
ORDER BY tablename, indexname;


-- ============================================================
-- 6. LISTER TOUTES LES CONTRAINTES DE CLÉ ÉTRANGÈRE
-- ============================================================

SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_schema = 'auth' OR ccu.table_schema = 'auth')
ORDER BY tc.table_schema, tc.table_name;


-- ============================================================
-- 7. COMPTER LES UTILISATEURS (auth.users)
-- ============================================================

SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_users
FROM auth.users;


-- ============================================================
-- 8. COMPTER LES SESSIONS ACTIVES
-- ============================================================

SELECT 
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN not_after > now() THEN 1 END) as active_sessions
FROM auth.sessions;


-- ============================================================
-- 9. STATISTIQUES DES PROVIDERS OAUTH
-- ============================================================

SELECT 
  provider,
  COUNT(*) as user_count
FROM auth.identities
GROUP BY provider
ORDER BY user_count DESC;


-- ============================================================
-- 10. VÉRIFIER LES CONNEXIONS AVEC VOS TABLES PUBLIC
-- ============================================================

-- A) Vérifier les contraintes de clé étrangère vers auth.users

SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_schema = 'auth'
  AND ccu.table_name = 'users'
ORDER BY tc.table_name;


-- ============================================================
-- 11. LISTER VOS TABLES PUBLIC QUI RÉFÉRENCENT auth.users
-- ============================================================

SELECT DISTINCT
  t.table_name,
  c.column_name,
  c.data_type
FROM information_schema.tables t
JOIN information_schema.columns c 
  ON t.table_name = c.table_name 
  AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND c.column_name IN ('user_id', 'creator_id')
  AND c.data_type = 'uuid'
ORDER BY t.table_name;


-- ============================================================
-- 12. STATISTIQUES DE VOTRE APPLICATION
-- ============================================================

-- Nombre total d'utilisateurs
SELECT 
  'Total Users' as metric,
  COUNT(*) as value
FROM auth.users
WHERE deleted_at IS NULL

UNION ALL

-- Nombre de quiz partagés
SELECT 
  'Shared Quizzes' as metric,
  COUNT(*) as value
FROM public.shared_quizzes

UNION ALL

-- Nombre de flashcards
SELECT 
  'Flashcards' as metric,
  COUNT(*) as value
FROM public.flashcards

UNION ALL

-- Nombre de tentatives de quiz
SELECT 
  'Quiz Attempts' as metric,
  COUNT(*) as value
FROM public.quiz_attempts

UNION ALL

-- Nombre de sessions de quiz
SELECT 
  'Quiz Sessions' as metric,
  COUNT(*) as value
FROM public.quiz_sessions;


-- ============================================================
-- 13. FONCTIONS DISPONIBLES DANS LE SCHÉMA auth
-- ============================================================

SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'auth'
ORDER BY routine_name;


-- ============================================================
-- 14. VÉRIFIER LES POLICIES RLS SUR VOS TABLES
-- ============================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ============================================================
-- 15. DERNIÈRES INSCRIPTIONS (Top 10)
-- ============================================================

SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at,
  is_sso_user
FROM auth.users
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;


-- ============================================================
-- FIN DES REQUÊTES D'INSPECTION
-- ============================================================

-- 💡 CONSEILS D'UTILISATION:
--
-- 1. Exécutez ces requêtes dans le SQL Editor de Supabase
-- 2. Vous pouvez exécuter toutes les requêtes ou seulement celles qui vous intéressent
-- 3. Ces requêtes sont en LECTURE SEULE (SELECT) donc sans danger
-- 4. Utilisez-les pour comprendre votre schéma auth existant
--
-- ⚠️ RAPPEL:
-- - Ne modifiez JAMAIS directement les tables auth.*
-- - Utilisez toujours l'API Supabase Auth pour l'authentification
-- - Les tables auth.* sont gérées automatiquement par Supabase
