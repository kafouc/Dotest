-- ============================================================
-- 1. join_session : limite de débit par IP et par session
--    Un visiteur anonyme ne peut plus remplir une session de faux participants à toute vitesse.
--    Limite volontairement large (60 / 10 min) : une classe entière partage souvent une seule IP.
--    Dépend de public.consume_rate_limit (20261024000000_api_rate_limits.sql).
-- 2. handle_new_user_plan : suppression de l'adresse e-mail codée en dur (plan pro).
--    Le compte concerné est déjà pro et admin ; les promotions passent par set_user_plan.
-- ============================================================

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
  v_ip text;
  v_allowed boolean;
begin
  if char_length(v_nick) < 1 or char_length(v_nick) > 30 then
    raise exception 'invalid nickname' using errcode = '22023';
  end if;

  -- IP du client telle que transmise par PostgREST (premier élément de x-forwarded-for)
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ip := coalesce(nullif(btrim(v_ip), ''), 'unknown');

  select r.allowed into v_allowed
  from public.consume_rate_limit(
    md5('join:' || v_ip)::uuid,
    'join:' || p_session_id::text,
    60,
    600
  ) r;
  if not coalesce(v_allowed, false) then
    raise exception 'too many join attempts' using errcode = '54000';
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

create or replace function public.handle_new_user_plan()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.user_plans (user_id, plan, assigned_by, metadata)
  values (NEW.id, 'freemium', null, jsonb_build_object('source', 'signup-default'))
  on conflict (user_id) do nothing;
  return NEW;
end;
$$;
