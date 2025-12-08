-- RESET COMPLET RLS (anti-récursion 42P17) pour le système Live Quiz
-- Ce script est idempotent et peut être exécuté en toute sécurité

-- 1) Fonctions SECURITY DEFINER pour éviter les EXISTS/JOIN dans les policies
create or replace function public.is_shared_quiz_active(p_shared_quiz_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.shared_quizzes
    where id = p_shared_quiz_id and is_active = true
  );
$$;

create or replace function public.is_quiz_creator(p_shared_quiz_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.shared_quizzes
    where id = p_shared_quiz_id and creator_id = p_user_id
  );
$$;

do $$
begin
  -- 2) SHARED_QUIZZES: policies
  -- DROP anciennes policies fourre-tout si présentes
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_all'
  ) then
    drop policy "sq_creator_all" on public.shared_quizzes;
  end if;

  -- SELECT public (quiz actif)
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='shared_quizzes' and policyname='sq_public_read'
  ) then
    create policy sq_public_read
      on public.shared_quizzes for select
      using (is_active = true);
  end if;

  -- SELECT créateur
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_select'
  ) then
    create policy sq_creator_select
      on public.shared_quizzes for select
      using (creator_id = auth.uid());
  end if;

  -- INSERT/UPDATE/DELETE créateur
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_insert'
  ) then
    create policy sq_creator_insert
      on public.shared_quizzes for insert
      with check (creator_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_update'
  ) then
    create policy sq_creator_update
      on public.shared_quizzes for update
      using (creator_id = auth.uid())
      with check (creator_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_delete'
  ) then
    create policy sq_creator_delete
      on public.shared_quizzes for delete
      using (creator_id = auth.uid());
  end if;

  -- 3) QUIZ_SESSIONS: reset complet
  -- DROP policies existantes pour éviter tout conflit
  perform 1 from pg_policies where schemaname='public' and tablename='quiz_sessions';
  if found then
    -- Drop connues (ignore si n'existe pas)
    begin
      drop policy "Public peut voir sessions pour quiz actif" on public.quiz_sessions; exception when others then null; end;
    begin
      drop policy qs_creator_all on public.quiz_sessions; exception when others then null; end;
    begin
      drop policy qs_participant_read on public.quiz_sessions; exception when others then null; end;
    begin
      drop policy qs_creator_insert on public.quiz_sessions; exception when others then null; end;
    begin
      drop policy qs_creator_update on public.quiz_sessions; exception when others then null; end;
    begin
      drop policy qs_creator_delete on public.quiz_sessions; exception when others then null; end;
  end if;

  -- SELECT public via helper (pas de JOIN/EXISTS)
  create policy "Public peut voir sessions pour quiz actif"
    on public.quiz_sessions for select
    using (public.is_shared_quiz_active(shared_quiz_id));

  -- INSERT/UPDATE/DELETE du créateur via helper
  create policy qs_creator_insert
    on public.quiz_sessions for insert
    with check (public.is_quiz_creator(shared_quiz_id, auth.uid()));
  create policy qs_creator_update
    on public.quiz_sessions for update
    using (public.is_quiz_creator(quiz_sessions.shared_quiz_id, auth.uid()))
    with check (public.is_quiz_creator(quiz_sessions.shared_quiz_id, auth.uid()));
  create policy qs_creator_delete
    on public.quiz_sessions for delete
    using (public.is_quiz_creator(quiz_sessions.shared_quiz_id, auth.uid()));

  -- 4) SESSION_PARTICIPANTS: supprimer la policy récursive et garder public
  begin
    drop policy sp_creator_read on public.session_participants; exception when others then null;
  end;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='session_participants' and policyname='sp_public_read'
  ) then
    create policy sp_public_read on public.session_participants for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='session_participants' and policyname='sp_public_join'
  ) then
    create policy sp_public_join on public.session_participants for insert with check (true);
  end if;
end $$;
