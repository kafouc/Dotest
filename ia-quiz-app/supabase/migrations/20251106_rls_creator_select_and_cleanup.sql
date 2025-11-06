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

  -- Ajouter une policy SELECT pour le créateur sur quiz_sessions
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_creator_select'
  ) then
    create policy qs_creator_select
      on public.quiz_sessions
      for select
      using (
        exists (
          select 1 from public.shared_quizzes sq
          where sq.id = quiz_sessions.shared_quiz_id
            and sq.creator_id = auth.uid()
        )
      );
  end if;
end $$;
