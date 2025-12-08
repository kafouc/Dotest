-- ============================================
-- SCRIPT DE VÉRIFICATION - Système Quiz Live
-- ============================================
-- Exécutez ce script dans Supabase SQL Editor pour vérifier l'état

-- 1. Vérifier si les tables existent
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers') 
    THEN '✅ Table existe'
    ELSE '❌ Table manquante'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY table_name;

-- 2. Vérifier les politiques RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression
FROM pg_policies 
WHERE tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY tablename, policyname;

-- 3. Vérifier si RLS est activé
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY tablename;

-- 4. Vérifier les publications Realtime
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY tablename;

-- 5. Vérifier la fonction generate_share_code
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'generate_share_code';

-- 6. Vérifier le trigger
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'set_share_code_trigger';

-- ============================================
-- RÉSULTATS ATTENDUS :
-- ============================================
-- 1. Tables : 4 tables doivent exister
-- 2. Politiques : Au moins 12 politiques (3 par table minimum)
-- 3. RLS : Toutes les tables doivent avoir rls_enabled = true
-- 4. Realtime : Les 4 tables doivent être dans supabase_realtime
-- 5. Fonction : generate_share_code doit exister
-- 6. Trigger : set_share_code_trigger doit exister sur shared_quizzes
