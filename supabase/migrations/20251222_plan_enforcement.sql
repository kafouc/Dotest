-- Plan-based enforcement triggers
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_session_participant_limit()
RETURNS trigger AS $$
DECLARE
  v_creator uuid;
  v_plan text;
  v_limit integer;
  v_effective_limit integer;
  v_count integer;
BEGIN
    SELECT sq.creator_id,
      COALESCE(up.plan, 'freemium') AS plan,
      sq.max_participants
    INTO v_creator, v_plan, v_effective_limit
  FROM public.quiz_sessions qs
  JOIN public.shared_quizzes sq ON sq.id = qs.shared_quiz_id
  LEFT JOIN public.user_plans up ON up.user_id = sq.creator_id
  WHERE qs.id = NEW.session_id;

  IF v_creator IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_plan = 'partial' THEN
    v_limit := 15;
  ELSIF v_plan = 'pro' THEN
    v_limit := 300;
  ELSE
    v_limit := 10;
  END IF;

  -- If max_participants explicitly set, take the minimum positive value
  IF v_effective_limit IS NOT NULL AND v_effective_limit > 0 THEN
    v_limit := LEAST(v_limit, v_effective_limit);
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.session_participants sp
  WHERE sp.session_id = NEW.session_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Nombre maximal de participants atteint pour ce plan (%).', v_plan
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_session_participants_plan_limit ON public.session_participants;
CREATE TRIGGER trg_session_participants_plan_limit
BEFORE INSERT ON public.session_participants
FOR EACH ROW
EXECUTE FUNCTION public.enforce_session_participant_limit();

COMMIT;
