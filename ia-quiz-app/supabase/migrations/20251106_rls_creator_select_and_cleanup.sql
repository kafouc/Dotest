-- Renforcer les policies SELECT côté créateur et nettoyer les policies obsolètes

do $$
begin
  -- =====================
  -- shared_quizzes: autoriser SELECT au créateur (en plus de la lecture publique is_active=true)
  -- =====================
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_select'
  ) then
    create policy sq_creator_select
      on public.shared_quizzes
      for select
      using (creator_id = auth.uid());
  end if;

  -- =====================
  -- quiz_sessions: supprimer la policy basée sur participants (potentiellement récursive/inutile)
  -- =====================
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_participant_read'
  ) then
    drop policy "qs_participant_read" on public.quiz_sessions;
  end if;

  -- NOTE: On ne crée PAS de policy qs_creator_select avec EXISTS vers shared_quizzes
  -- car cela cause une récursion infinie avec la policy publique qui vérifie is_active.
  -- Le créateur accèdera à ses sessions via la policy publique "Public peut voir sessions pour quiz actif"
  -- et pourra gérer l'état via les policies UPDATE/DELETE déjà en place.
end $$;
