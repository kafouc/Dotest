-- Séparer les policies SELECT des policies WRITE pour éviter l'évaluation de auth.uid() sur SELECT
-- IMPORTANT: Pour éviter les récursions RLS, on utilise une fonction SECURITY DEFINER pour les checks

-- Fonction helper pour vérifier si l'utilisateur est créateur d'un quiz (bypass RLS)
create or replace function public.is_quiz_creator(p_shared_quiz_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.shared_quizzes
    where id = p_shared_quiz_id and creator_id = p_user_id
  );
$$;

do $$
begin
  -- =====================
  -- shared_quizzes
  -- =====================
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_all'
  ) then
    drop policy "sq_creator_all" on public.shared_quizzes;
  end if;

  -- Créateur: INSERT
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_insert'
  ) then
    create policy sq_creator_insert
      on public.shared_quizzes
      for insert
      with check (creator_id = auth.uid());
  end if;

  -- Créateur: UPDATE
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_update'
  ) then
    create policy sq_creator_update
      on public.shared_quizzes
      for update
      using (creator_id = auth.uid())
      with check (creator_id = auth.uid());
  end if;

  -- Créateur: DELETE
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_delete'
  ) then
    create policy sq_creator_delete
      on public.shared_quizzes
      for delete
      using (creator_id = auth.uid());
  end if;

  -- La policy SELECT publique sq_public_read (is_active=true) existe déjà via migrations précédentes

  -- =====================
  -- quiz_sessions
  -- =====================
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_creator_all'
  ) then
    drop policy "qs_creator_all" on public.quiz_sessions;
  end if;

  -- Créateur: INSERT
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_creator_insert'
  ) then
    create policy qs_creator_insert
      on public.quiz_sessions
      for insert
      with check (
        public.is_quiz_creator(shared_quiz_id, auth.uid())
      );
  end if;

  -- Créateur: UPDATE
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_creator_update'
  ) then
    create policy qs_creator_update
      on public.quiz_sessions
      for update
      using (
        public.is_quiz_creator(quiz_sessions.shared_quiz_id, auth.uid())
      )
      with check (
        public.is_quiz_creator(quiz_sessions.shared_quiz_id, auth.uid())
      );
  end if;

  -- Créateur: DELETE
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_creator_delete'
  ) then
    create policy qs_creator_delete
      on public.quiz_sessions
      for delete
      using (
        public.is_quiz_creator(quiz_sessions.shared_quiz_id, auth.uid())
      );
  end if;

  -- La policy SELECT publique sur quiz_sessions (quiz actif) a été ajoutée dans 20251106_rls_public_select_sessions.sql
end $$;
