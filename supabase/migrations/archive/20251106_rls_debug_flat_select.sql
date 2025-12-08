-- ARCHIVE: Migration de debug (aplatissement RLS quiz_sessions) conservée pour référence
-- Ne pas réexécuter en production.

-- Contenu original:
-- DEBUG TEMPORAIRE: APLATIR RLS SUR quiz_sessions POUR ISOLER LA RÉCURRENCE
-- OBJECTIF: Vérifier si l'erreur 42P17 persiste sans aucune dépendance
-- À UTILISER SEULEMENT POUR DIAGNOSTIC PUIS SUPPRIMER / REMETTRE LES POLICIES SÉCURISÉES

do $$
begin
  -- Désactiver toutes les policies existantes sur quiz_sessions
  begin drop policy "Public peut voir sessions pour quiz actif" on public.quiz_sessions; exception when others then null; end;
  begin drop policy qs_creator_insert on public.quiz_sessions; exception when others then null; end;
  begin drop policy qs_creator_update on public.quiz_sessions; exception when others then null; end;
  begin drop policy qs_creator_delete on public.quiz_sessions; exception when others then null; end;
  begin drop policy qs_creator_all on public.quiz_sessions; exception when others then null; end;
  begin drop policy qs_participant_read on public.quiz_sessions; exception when others then null; end;

  -- Créer une seule policy SELECT ouverte pour confirmer la disparition de l'erreur
  create policy qs_debug_public_select
    on public.quiz_sessions for select
    using (true);
end $$;
