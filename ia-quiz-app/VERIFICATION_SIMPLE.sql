-- ============================================
-- VÉRIFICATION RAPIDE - Sans Erreur
-- ============================================
-- Ce script vérifie l'installation SANS déclencher d'exceptions
-- Parfait pour voir l'état actuel du système

-- 📊 Vue d'ensemble
SELECT 
  '🔍 ÉTAT DU SYSTÈME' as titre,
  '==================' as separateur;

-- 1️⃣ Tables
SELECT 
  '1. TABLES' as section,
  table_name as nom,
  CASE 
    WHEN table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
    THEN '✅ OK'
    ELSE '❓ Inattendue'
  END as statut
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
       OR table_name LIKE '%quiz%' OR table_name LIKE '%session%' OR table_name LIKE '%answer%')
ORDER BY table_name;

-- 2️⃣ RLS (Row Level Security)
SELECT 
  '2. RLS ACTIVÉ' as section,
  tablename as table,
  CASE 
    WHEN rowsecurity = true THEN '✅ Activé'
    ELSE '❌ Désactivé'
  END as statut
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY tablename;

-- 3️⃣ Politiques RLS
SELECT 
  '3. POLITIQUES RLS' as section,
  tablename as table,
  COUNT(*) as nombre_politiques
FROM pg_policies
WHERE tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
GROUP BY tablename
ORDER BY tablename;

-- 4️⃣ Index
SELECT 
  '4. INDEX' as section,
  tablename as table,
  indexname as nom_index,
  '✅ OK' as statut
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY tablename, indexname;

-- 5️⃣ Fonctions
SELECT 
  '5. FONCTIONS' as section,
  routine_name as nom,
  routine_type as type,
  CASE 
    WHEN routine_name IN ('generate_share_code', 'fn_generate_unique_share_code')
    THEN '✅ OK'
    ELSE '❓ Autre'
  END as statut
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%share%' OR routine_name LIKE '%code%')
ORDER BY routine_name;

-- 6️⃣ Triggers
SELECT 
  '6. TRIGGERS' as section,
  trigger_name as nom,
  event_object_table as table,
  CASE 
    WHEN trigger_name = 'trg_shared_quizzes_generate_code'
    THEN '✅ OK'
    ELSE '❓ Autre'
  END as statut
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY event_object_table, trigger_name;

-- 7️⃣ Realtime
SELECT 
  '7. REALTIME' as section,
  tablename as table,
  '✅ Activé' as statut
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
ORDER BY tablename;

-- 📈 Résumé Final
SELECT 
  '📈 RÉSUMÉ' as section,
  'Tables' as element,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers'))::text || ' / 4' as resultat
UNION ALL
SELECT 
  '📈 RÉSUMÉ',
  'Politiques RLS',
  (SELECT COUNT(*) FROM pg_policies 
   WHERE tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers'))::text || ' (min 12)' as resultat
UNION ALL
SELECT 
  '📈 RÉSUMÉ',
  'Fonctions',
  (SELECT COUNT(*) FROM pg_proc 
   WHERE proname IN ('generate_share_code', 'fn_generate_unique_share_code'))::text || ' / 2' as resultat
UNION ALL
SELECT 
  '📈 RÉSUMÉ',
  'Triggers',
  (SELECT COUNT(*) FROM information_schema.triggers 
   WHERE trigger_name = 'trg_shared_quizzes_generate_code')::text || ' / 1' as resultat
UNION ALL
SELECT 
  '📈 RÉSUMÉ',
  'Realtime',
  (SELECT COUNT(*) FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND tablename IN ('quiz_sessions', 'session_participants', 'live_answers'))::text || ' / 3' as resultat;

-- ============================================
-- 💡 INTERPRÉTATION
-- ============================================

SELECT 
  '💡 RÉSULTAT' as titre,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')) = 4
    AND (SELECT COUNT(*) FROM pg_policies 
         WHERE tablename IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')) >= 12
    AND (SELECT COUNT(*) FROM pg_proc 
         WHERE proname IN ('generate_share_code', 'fn_generate_unique_share_code')) = 2
    AND (SELECT COUNT(*) FROM information_schema.triggers 
         WHERE trigger_name = 'trg_shared_quizzes_generate_code') = 1
    THEN '✅ INSTALLATION COMPLÈTE - Système prêt à l''emploi !'
    
    WHEN (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')) = 0
    THEN '❌ AUCUNE TABLE - Exécutez la migration 20251106_live_quiz_system.sql ou INSTALL_STEP_BY_STEP.sql'
    
    ELSE '⚠️ INSTALLATION PARTIELLE - Réexécutez la migration complète'
  END as diagnostic;

-- ============================================
-- 📋 ACTIONS RECOMMANDÉES
-- ============================================

SELECT 
  '📋 PROCHAINES ÉTAPES' as titre,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')) = 4
    THEN '1. ✅ Tables OK
2. Vérifier Database → Replication (activer les 3 tables si pas déjà fait)
3. Rechargez l''application (Ctrl+Shift+R)
4. Testez "Partager en temps réel"'
    ELSE '1. Exécutez INSTALL_STEP_BY_STEP.sql
2. Réexécutez ce script pour vérifier
3. Activez Realtime dans Database → Replication'
  END as actions;
