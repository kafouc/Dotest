-- ============================================
-- FIX RAPIDE: Auto-remplir creator_id
-- ============================================
-- Ce script résout le problème "Aucun utilisateur connecté"
-- en ajoutant un trigger qui remplit automatiquement creator_id

-- Créer la fonction qui auto-remplit creator_id
create or replace function public.fn_set_creator_id()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Si creator_id n'est pas fourni, utiliser l'utilisateur connecté
  if new.creator_id is null then
    new.creator_id := auth.uid();
  end if;
  
  -- Validation: vérifier qu'on a bien un utilisateur
  if new.creator_id is null then
    raise exception 'Impossible de créer un quiz sans être connecté';
  end if;
  
  return new;
end;
$$;

-- Supprimer l'ancien trigger s'il existe
drop trigger if exists trg_shared_quizzes_set_creator on public.shared_quizzes;

-- Créer le nouveau trigger
create trigger trg_shared_quizzes_set_creator
before insert on public.shared_quizzes
for each row execute function public.fn_set_creator_id();

-- ============================================
-- VÉRIFICATION
-- ============================================

-- Vérifier que le trigger existe
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Trigger créé avec succès !'
    ELSE '❌ Erreur: trigger non créé'
  END as resultat
FROM information_schema.triggers
WHERE trigger_name = 'trg_shared_quizzes_set_creator'
  AND event_object_table = 'shared_quizzes';

-- ============================================
-- PROCHAINES ÉTAPES
-- ============================================
-- 1. Rechargez complètement l'application (Ctrl+Shift+R)
-- 2. Assurez-vous d'être DÉCONNECTÉ puis RECONNECTÉ
-- 3. Testez "Partager en temps réel"
-- 
-- Le trigger va maintenant remplir automatiquement creator_id
-- avec l'ID de l'utilisateur connecté dans la session browser.
