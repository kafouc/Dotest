-- ============================================================
-- Live quiz : sécurisation (correction côté base, plus de lecture publique des réponses)
--
-- Avant : n'importe quel client anonyme pouvait
--   * lire shared_quizzes.questions (donc reponse_correcte + justification),
--   * insérer des live_answers avec is_correct choisi par le client,
--   * lire/écrire les réponses de n'importe quel participant (auth.uid() is null),
--   * s'inscrire sans limite à n'importe quelle session.
-- Désormais tout passe par des RPC SECURITY DEFINER qui valident l'état de la session.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Helpers (bypass RLS, évitent la récursion)
-- ------------------------------------------------------------
create or replace function public.is_session_creator(p_session_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.quiz_sessions qs
    join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
    where qs.id = p_session_id
      and sq.creator_id = auth.uid()
  );
$$;

revoke all on function public.is_session_creator(uuid) from public;
grant execute on function public.is_session_creator(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 2) Participants : jeton secret (stocké haché) pour authentifier un élève anonyme
-- ------------------------------------------------------------
alter table public.session_participants
  add column if not exists token_hash text;

-- ------------------------------------------------------------
-- 3) Policies : suppression des accès publics / anonymes
-- ------------------------------------------------------------
drop policy if exists sq_public_read on public.shared_quizzes;          -- exposait les bonnes réponses
drop policy if exists sp_public_join on public.session_participants;    -- with check (true)
drop policy if exists sp_public_read on public.session_participants;    -- using (true)
drop policy if exists sp_creator_read on public.session_participants;
drop policy if exists la_participant_own on public.live_answers;        -- auth.uid() is null => tout le monde
drop policy if exists la_creator_read on public.live_answers;
drop policy if exists qs_participant_read on public.quiz_sessions;      -- auth.uid() is null => tout le monde
drop policy if exists qs_creator_select on public.quiz_sessions;

-- Le créateur lit les participants et réponses de ses sessions (lecture seule : l'écriture passe par les RPC)
create policy sp_creator_read
  on public.session_participants
  for select
  using (public.is_session_creator(session_id));

create policy la_creator_read
  on public.live_answers
  for select
  using (public.is_session_creator(session_id));

-- Le créateur voit ses sessions même si le quiz n'est plus actif.
-- (La lecture publique de quiz_sessions reste nécessaire au Realtime des élèves ;
--  la table ne contient que statut et dates.)
create policy qs_creator_select
  on public.quiz_sessions
  for select
  using (public.is_quiz_creator(shared_quiz_id, auth.uid()));

-- ------------------------------------------------------------
-- 4) RPC : quiz public SANS bonnes réponses
-- ------------------------------------------------------------
create or replace function public.get_public_quiz(p_share_code text)
returns jsonb
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', sq.id,
    'title', sq.title,
    'share_code', sq.share_code,
    'questions', coalesce(
      (
        select jsonb_agg(q - 'reponse_correcte' - 'justification' order by ord)
        from jsonb_array_elements(sq.questions) with ordinality as t(q, ord)
      ),
      '[]'::jsonb
    )
  )
  from public.shared_quizzes sq
  where sq.share_code = upper(p_share_code)
    and sq.is_active = true
    and (sq.expires_at is null or sq.expires_at > now());
$$;

revoke all on function public.get_public_quiz(text) from public;
grant execute on function public.get_public_quiz(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5) RPC : rejoindre une session
-- ------------------------------------------------------------
create or replace function public.join_session(p_session_id uuid, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nick text := btrim(coalesce(p_nickname, ''));
  v_status text;
  v_max int;
  v_token uuid := gen_random_uuid();
  v_id uuid;
begin
  if char_length(v_nick) < 1 or char_length(v_nick) > 30 then
    raise exception 'invalid nickname' using errcode = '22023';
  end if;

  select qs.status, sq.max_participants
    into v_status, v_max
  from public.quiz_sessions qs
  join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
  where qs.id = p_session_id
    and sq.is_active = true
    and (sq.expires_at is null or sq.expires_at > now());

  if v_status is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if v_status = 'completed' then
    raise exception 'session completed' using errcode = '22023';
  end if;
  if v_max is not null
     and (select count(*) from public.session_participants where session_id = p_session_id) >= v_max then
    raise exception 'session full' using errcode = '22023';
  end if;

  -- unique(session_id, nickname) => 23505 si le pseudo est pris
  insert into public.session_participants (session_id, nickname, user_id, token_hash)
  values (
    p_session_id,
    v_nick,
    auth.uid(),
    encode(sha256(convert_to(v_token::text, 'UTF8')), 'hex')
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'session_id', p_session_id,
    'nickname', v_nick,
    'token', v_token
  );
end;
$$;

revoke all on function public.join_session(uuid, text) from public;
grant execute on function public.join_session(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 6) RPC : soumettre une réponse (correction calculée ici, pas par le client)
-- ------------------------------------------------------------
create or replace function public.submit_live_answer(
  p_participant_id uuid,
  p_token uuid,
  p_question_index int,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_token_hash text;
  v_status text;
  v_questions jsonb;
  v_question jsonb;
  v_letter text := upper(btrim(coalesce(p_answer, '')));
  v_correct text;
  v_is_correct boolean;
begin
  select sp.session_id, sp.token_hash, qs.status, sq.questions
    into v_session_id, v_token_hash, v_status, v_questions
  from public.session_participants sp
  join public.quiz_sessions qs on qs.id = sp.session_id
  join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
  where sp.id = p_participant_id;

  if v_session_id is null
     or p_token is null
     or v_token_hash is distinct from encode(sha256(convert_to(p_token::text, 'UTF8')), 'hex') then
    raise exception 'invalid participant' using errcode = '42501';
  end if;

  if v_status <> 'active' then
    raise exception 'session not active' using errcode = '22023';
  end if;

  if v_letter !~ '^[ABCD]$' then
    raise exception 'invalid answer' using errcode = '22023';
  end if;

  if p_question_index is null
     or p_question_index < 0
     or p_question_index >= jsonb_array_length(v_questions) then
    raise exception 'invalid question index' using errcode = '22023';
  end if;

  v_question := v_questions -> p_question_index;
  v_correct := coalesce(
    substring(upper(btrim(v_question ->> 'reponse_correcte')) from '^[\s\(\[]*([ABCD])'),
    upper(btrim(v_question ->> 'reponse_correcte'))
  );
  v_is_correct := (v_letter = v_correct);

  -- unique(session_id, participant_id, question_index) => 23505 si déjà répondu
  insert into public.live_answers (
    session_id, participant_id, question_index, answer, answer_text, is_correct
  ) values (
    v_session_id,
    p_participant_id,
    p_question_index,
    v_letter,
    v_question -> 'options' ->> v_letter,
    v_is_correct
  );

  update public.session_participants
     set last_activity_at = now()
   where id = p_participant_id;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_answer', v_correct,
    'justification', v_question ->> 'justification'
  );
end;
$$;

revoke all on function public.submit_live_answer(uuid, uuid, int, text) from public;
grant execute on function public.submit_live_answer(uuid, uuid, int, text) to anon, authenticated;
