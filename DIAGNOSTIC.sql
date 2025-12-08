-- ============================================
-- SCRIPT DE DIAGNOSTIC RAPIDE
-- ============================================
-- Copiez-collez dans Supabase SQL Editor et cliquez "Run"
-- Ce script diagnostique pourquoi le partage ne fonctionne pas

-- 🔍 Test 1 : Les tables existent-elles ?
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers');
  
  IF table_count = 4 THEN
    RAISE NOTICE '✅ SUCCESS : Les 4 tables existent';
  ELSIF table_count = 0 THEN
    RAISE EXCEPTION '❌ ERREUR CRITIQUE : Aucune table trouvée. Vous DEVEZ exécuter la migration 20251106_live_quiz_system.sql';
  ELSE
    RAISE WARNING '⚠️ ATTENTION : Seulement % tables sur 4 trouvées. Réexécutez la migration complète.', table_count;
  END IF;
END $$;

-- 🔍 Test 2 : RLS est-il activé ?
DO $$
DECLARE
  rls_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
    AND rowsecurity = true;
  
  IF rls_count = 4 THEN
    RAISE NOTICE '✅ SUCCESS : RLS activé sur les 4 tables';
  ELSE
    RAISE WARNING '⚠️ ATTENTION : RLS activé seulement sur % tables sur 4', rls_count;
  END IF;
END $$;

-- 🔍 Test 3 : Les politiques RLS existent-elles ?
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers');
  
  IF policy_count >= 12 THEN
    RAISE NOTICE '✅ SUCCESS : % politiques RLS trouvées (minimum 12)', policy_count;
  ELSIF policy_count = 0 THEN
    RAISE EXCEPTION '❌ ERREUR CRITIQUE : Aucune politique RLS. Exécutez la migration 20251106_live_quiz_system.sql';
  ELSE
    RAISE WARNING '⚠️ ATTENTION : Seulement % politiques RLS (attendu : minimum 12)', policy_count;
  END IF;
END $$;

-- 🔍 Test 4 : La fonction generate_share_code existe-t-elle ?
DO $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'generate_share_code'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '✅ SUCCESS : Fonction generate_share_code existe';
  ELSE
    RAISE EXCEPTION '❌ ERREUR : Fonction generate_share_code manquante. Exécutez la migration.';
  END IF;
END $$;

-- 🔍 Test 5 : Le trigger existe-t-il ?
DO $$
DECLARE
  trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_shared_quizzes_generate_code'
      AND event_object_table = 'shared_quizzes'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ SUCCESS : Trigger trg_shared_quizzes_generate_code existe';
  ELSE
    RAISE EXCEPTION '❌ ERREUR : Trigger manquant. Exécutez la migration 20251106_live_quiz_system.sql';
  END IF;
END $$;

-- 🔍 Test 6 : Test d'insertion (simulation)
DO $$
DECLARE
  can_insert BOOLEAN := false;
BEGIN
  -- Teste si l'utilisateur connecté peut insérer
  BEGIN
    -- Cette requête simule l'insertion sans vraiment insérer
    PERFORM 1 FROM shared_quizzes LIMIT 0;
    can_insert := true;
  EXCEPTION WHEN OTHERS THEN
    can_insert := false;
  END;
  
  IF can_insert THEN
    RAISE NOTICE '✅ SUCCESS : Permissions d''insertion semblent OK';
  ELSE
    RAISE WARNING '⚠️ ATTENTION : Problème potentiel de permissions';
  END IF;
END $$;

-- 🔍 Test 7 : Afficher les détails des politiques RLS
SELECT 
  '📋 Politiques RLS pour ' || tablename as info,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual 
    ELSE 'Pas de condition USING'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'Pas de WITH CHECK'
  END as check_clause
FROM pg_policies
WHERE tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY tablename, policyname;

-- ============================================
-- 📊 RÉSUMÉ DES TESTS
-- ============================================
-- Regardez les messages ci-dessus :
--   ✅ SUCCESS = Tout est OK
--   ⚠️ ATTENTION = Problème mineur
--   ❌ ERREUR = Problème critique, migration requise
--
-- Si vous voyez des ❌ ERREUR :
--   → Exécutez la migration 20251106_live_quiz_system.sql
--
-- Si tout est ✅ SUCCESS mais erreur 403 persiste :
--   → Vérifiez que l'utilisateur est bien connecté
--   → Vérifiez les variables d'environnement Supabase
--   → Rechargez complètement l'application (Ctrl+Shift+R)
