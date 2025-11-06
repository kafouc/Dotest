-- Autoriser la lecture publique des sessions liées à un quiz partagé actif
-- Utile pour que les élèves trouvent la session via le code sans être déjà participants

create policy if not exists "Public peut voir sessions pour quiz actif"
  on public.quiz_sessions for select
  using (
    exists (
      select 1 from public.shared_quizzes sq
      where sq.id = quiz_sessions.shared_quiz_id
        and sq.is_active = true
    )
  );
