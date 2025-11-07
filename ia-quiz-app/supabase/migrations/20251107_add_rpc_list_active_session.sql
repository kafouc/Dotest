-- ============================================================
-- RPC: list_active_session (SECURITY DEFINER)
-- Retourne la session active/en attente pour un code de partage donné
-- Permet aux élèves (même anonymes) de récupérer l'ID de session sans heurter les policies RLS
-- ============================================================

create or replace function public.list_active_session(p_share_code text)
returns table (
  session_id uuid,
  share_code text,
  title text,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  questions_count int
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select 
    qs.id as session_id,
    sq.share_code,
    sq.title,
    coalesce(qs.status, 'waiting') as status,
    qs.started_at,
    sq.expires_at,
    jsonb_array_length(sq.questions) as questions_count
  from public.shared_quizzes sq
  left join public.quiz_sessions qs on qs.shared_quiz_id = sq.id
  where sq.share_code = upper(p_share_code)
    and sq.is_active = true
    and (sq.expires_at is null or sq.expires_at > now())
    and (qs.status in ('waiting','active') or qs.id is null)
  order by 
    case when qs.status = 'active' then 0
         when qs.status = 'waiting' then 1
         else 2 end,
    qs.created_at desc nulls last
  limit 1;
$$;

-- Restreindre les privilèges puis accorder explicitement l'exécution aux rôles clients
revoke all on function public.list_active_session(text) from public;
grant execute on function public.list_active_session(text) to anon, authenticated;
