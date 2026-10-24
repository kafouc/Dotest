-- ============================================================
-- Live quiz : correction côté base pour tous les formats de question
--   * QCU : reponse_correcte = lettre
--   * QCM : reponses_correctes = tableau de lettres (réponse acceptée si la lettre choisie en fait partie,
--           comme le faisait isAnswerCorrect côté client)
--   * VF  : reponse_correcte = VRAI | FAUX
-- La lettre envoyée par l'élève est la POSITION de l'option affichée (A = 1re, B = 2e...),
-- dans l'ordre canonique des clés jsonb, identique à celui servi au navigateur.
-- À exécuter APRÈS 20251108_live_quiz_secure.sql.
-- ============================================================

create or replace function public.live_quiz_option_letter(p_options jsonb, p_value text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := upper(btrim(coalesce(p_value, '')));
  pos int;
begin
  if v = 'TRUE' then v := 'VRAI'; elsif v = 'FALSE' then v := 'FAUX'; end if;

  if jsonb_typeof(p_options) = 'object' then
    select t.ord::int into pos
    from jsonb_object_keys(p_options) with ordinality as t(k, ord)
    where upper(t.k) = v
    limit 1;
    if pos between 1 and 4 then
      return chr(64 + pos);
    end if;
  end if;

  return substring(v from '^[\s\(\[]*([ABCD])');
end;
$$;

revoke all on function public.live_quiz_option_letter(jsonb, text) from public, anon, authenticated;

-- Quiz public : retire TOUTES les clés de correction
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
        select jsonb_agg(q - 'reponse_correcte' - 'reponses_correctes' - 'justification' order by ord)
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
  v_opts jsonb;
  v_letter text := upper(btrim(coalesce(p_answer, '')));
  v_corrects text[];
  v_is_correct boolean;
  v_answer_text text;
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
  v_opts := v_question -> 'options';

  if jsonb_typeof(v_question -> 'reponses_correctes') = 'array' then
    select array_agg(distinct l) into v_corrects
    from (
      select public.live_quiz_option_letter(v_opts, e) as l
      from jsonb_array_elements_text(v_question -> 'reponses_correctes') as e
    ) s
    where l is not null;
  else
    v_corrects := array[public.live_quiz_option_letter(v_opts, v_question ->> 'reponse_correcte')];
  end if;

  v_is_correct := coalesce(v_letter = any(v_corrects), false);

  select v_opts ->> t.k into v_answer_text
  from jsonb_object_keys(v_opts) with ordinality as t(k, ord)
  where t.ord = ascii(v_letter) - 64;

  -- unique(session_id, participant_id, question_index) => 23505 si déjà répondu
  insert into public.live_answers (
    session_id, participant_id, question_index, answer, answer_text, is_correct
  ) values (
    v_session_id, p_participant_id, p_question_index, v_letter, v_answer_text, v_is_correct
  );

  update public.session_participants
     set last_activity_at = now()
   where id = p_participant_id;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_answer', array_to_string(coalesce(v_corrects, '{}'), ','),
    'justification', v_question ->> 'justification'
  );
end;
$$;

revoke all on function public.submit_live_answer(uuid, uuid, int, text) from public;
grant execute on function public.submit_live_answer(uuid, uuid, int, text) to anon, authenticated;
