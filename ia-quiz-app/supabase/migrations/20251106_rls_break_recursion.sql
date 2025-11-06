-- Corrige l'erreur: infinite recursion detected in policy for relation "quiz_sessions"
-- Cause: policy SELECT sur session_participants (sp_creator_read) joignant quiz_sessions
--        est évaluée lors d'un SELECT sur quiz_sessions (policy qs_participant_read)
--        ce qui réévalue les policies de quiz_sessions et crée une récursion.

do $$
begin
  -- Supprimer la policy sélective récursive sur session_participants
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='session_participants' and policyname='sp_creator_read'
  ) then
    drop policy "sp_creator_read" on public.session_participants;
  end if;

  -- S'assurer qu'une policy SELECT non récursive est en place (publique)
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='session_participants' and policyname='sp_public_read'
  ) then
    create policy sp_public_read
      on public.session_participants
      for select
      using (true);
  end if;
end $$;
