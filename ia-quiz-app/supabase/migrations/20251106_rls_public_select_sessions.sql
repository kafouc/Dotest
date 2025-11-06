-- Autoriser la lecture publique des sessions liées à un quiz partagé actif
-- Utile pour que les élèves trouvent la session via le code sans être déjà participants
-- 
-- IMPORTANT: Pour éviter la récursion RLS (42P17), on utilise une fonction SECURITY DEFINER
-- qui court-circuite RLS lors de la vérification du shared_quiz

-- Fonction helper pour vérifier si un quiz est actif (SECURITY DEFINER = bypass RLS)
create or replace function public.is_shared_quiz_active(p_shared_quiz_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.shared_quizzes
    where id = p_shared_quiz_id and is_active = true
  );
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='quiz_sessions'
      and policyname='Public peut voir sessions pour quiz actif'
  ) then
    create policy "Public peut voir sessions pour quiz actif"
      on public.quiz_sessions for select
      using (public.is_shared_quiz_active(shared_quiz_id));
  end if;
end $$;
