-- ============================================================
-- RPC: create_quiz_session (sécurisée)
-- Crée une session pour un quiz partagé si l'appelant est le créateur
-- ============================================================

create or replace function public.create_quiz_session(p_shared_quiz_id uuid)
returns public.quiz_sessions
language plpgsql
security definer
as $$
declare
  v_session public.quiz_sessions;
begin
  -- Vérifier que l'appelant est bien le créateur du quiz
  if not exists (
    select 1 from public.shared_quizzes sq
    where sq.id = p_shared_quiz_id
      and sq.creator_id = auth.uid()
  ) then
    raise exception 'permission denied: only creator can create a session for this quiz'
      using errcode = '42501';
  end if;

  insert into public.quiz_sessions(shared_quiz_id, status)
  values (p_shared_quiz_id, 'waiting')
  returning * into v_session;

  return v_session;
end;
$$;

-- Donner un search_path minimal pour éviter les surprises
alter function public.create_quiz_session(uuid) set search_path = public, pg_temp;
