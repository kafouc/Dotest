-- Daily streak tracking schema and helper functions
BEGIN;

-- Table storing per-user streak state and notification tracking
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  last_activity_at timestamptz,
  timezone text NOT NULL DEFAULT 'Europe/Paris',
  should_notify boolean NOT NULL DEFAULT true,
  reminders_sent_today integer NOT NULL DEFAULT 0,
  last_reminder_day date,
  last_reminder_window text,
  last_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_streaks_reminder_window_check CHECK (
    last_reminder_window IS NULL OR last_reminder_window IN ('morning', 'midday', 'evening')
  )
);

COMMENT ON TABLE public.user_streaks IS 'Stocke l''état des flammes utilisateurs (streak) et le suivi des rappels.';
COMMENT ON COLUMN public.user_streaks.timezone IS 'Fuseau horaire préféré pour le calcul des rappels et de la journée streak.';

-- Ensure updated_at stays fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_streaks_updated_at ON public.user_streaks;
CREATE TRIGGER trg_user_streaks_updated_at
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index to quickly find users needing reminders
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_active_date
  ON public.user_streaks (last_active_date)
  WHERE should_notify = true;

-- RLS policies
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_streaks'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.user_streaks', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY user_streaks_select_self
  ON public.user_streaks
  FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY user_streaks_update_self
  ON public.user_streaks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_streaks_insert_self
  ON public.user_streaks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_streaks_delete_service
  ON public.user_streaks
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Helper to update streak counters when a user studies
CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id uuid,
  p_activity_at timestamptz DEFAULT now()
)
RETURNS public.user_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text := auth.role();
  v_calling_user uuid := auth.uid();
  v_record public.user_streaks%ROWTYPE;
  v_timezone text;
  v_activity_date date;
  v_new_current integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id requis';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND (v_calling_user IS NULL OR v_calling_user <> p_user_id) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_record
  FROM public.user_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_timezone := 'Europe/Paris';
    v_activity_date := (p_activity_at AT TIME ZONE v_timezone)::date;

    INSERT INTO public.user_streaks (
      user_id,
      current_streak,
      longest_streak,
      last_active_date,
      last_activity_at,
      timezone,
      should_notify,
      reminders_sent_today,
      last_reminder_day,
      last_reminder_window,
      last_reminder_sent_at
    )
    VALUES (
      p_user_id,
      1,
      1,
      v_activity_date,
      p_activity_at,
      v_timezone,
      true,
      0,
      v_activity_date,
      NULL,
      NULL
    )
    RETURNING * INTO v_record;

    RETURN v_record;
  END IF;

  v_timezone := COALESCE(v_record.timezone, 'Europe/Paris');
  v_activity_date := (p_activity_at AT TIME ZONE v_timezone)::date;

  IF v_record.last_active_date IS NULL THEN
    v_new_current := 1;
  ELSIF v_record.last_active_date = v_activity_date THEN
    v_new_current := GREATEST(v_record.current_streak, 1);
  ELSIF v_record.last_active_date = (v_activity_date - INTERVAL '1 day')::date THEN
    v_new_current := v_record.current_streak + 1;
  ELSE
    v_new_current := 1;
  END IF;

  UPDATE public.user_streaks
  SET current_streak = v_new_current,
      longest_streak = GREATEST(v_record.longest_streak, v_new_current),
      last_active_date = v_activity_date,
      last_activity_at = p_activity_at,
      reminders_sent_today = 0,
      last_reminder_day = v_activity_date,
      last_reminder_window = NULL,
      last_reminder_sent_at = NULL,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

COMMENT ON FUNCTION public.update_user_streak IS 'Met à jour la flamme (streak) pour un utilisateur donné.';

-- Helper to log reminder sends with reset across day boundaries
CREATE OR REPLACE FUNCTION public.mark_streak_reminder_sent(
  p_user_id uuid,
  p_day date,
  p_window text,
  p_sent_at timestamptz DEFAULT now()
)
RETURNS public.user_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_record public.user_streaks%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Accès réservé au service' USING ERRCODE = '42501';
  END IF;

  IF p_window IS NULL OR p_window NOT IN ('morning', 'midday', 'evening') THEN
    RAISE EXCEPTION 'Fenêtre de rappel invalide: %', p_window;
  END IF;

  SELECT * INTO v_record
  FROM public.user_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_record.last_reminder_day IS DISTINCT FROM p_day THEN
    v_record.reminders_sent_today := 0;
  END IF;

  UPDATE public.user_streaks
  SET reminders_sent_today = v_record.reminders_sent_today + 1,
      last_reminder_day = p_day,
      last_reminder_window = p_window,
      last_reminder_sent_at = p_sent_at,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

COMMENT ON FUNCTION public.mark_streak_reminder_sent IS 'Enregistre l''envoi d''un rappel pour la flamme quotidienne.';

-- Extend admin overview with streak information
DROP FUNCTION IF EXISTS public.admin_list_user_activity();
CREATE FUNCTION public.admin_list_user_activity()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  documents_count bigint,
  quizzes_generated bigint,
  revisions_generated bigint,
  plan text,
  challenges_shared bigint,
  quiz_exports bigint,
  summary_exports bigint,
  live_recap_exports bigint,
  excel_exports bigint,
  created_at timestamptz,
  current_streak integer,
  longest_streak integer,
  last_active_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH doc AS (
    SELECT d.user_id, COUNT(*)::bigint AS documents_count
    FROM public.documents AS d
    WHERE d.user_id IS NOT NULL
    GROUP BY d.user_id
  ),
  quiz AS (
    SELECT e.user_id, COUNT(*)::bigint AS quizzes_generated
    FROM public.metrics_ai_usage_events AS e
    WHERE e.user_id IS NOT NULL
      AND e.metadata ->> 'route' = 'generate-quiz'
      AND COALESCE(e.metadata ->> 'stage', '') <> 'embedding'
    GROUP BY e.user_id
  ),
  revision AS (
    SELECT e.user_id, COUNT(*)::bigint AS revisions_generated
    FROM public.metrics_ai_usage_events AS e
    WHERE e.user_id IS NOT NULL
      AND e.metadata ->> 'route' = 'generate-summary'
      AND COALESCE(e.metadata ->> 'stage', '') <> 'embedding'
    GROUP BY e.user_id
  ),
  shared AS (
    SELECT sq.creator_id AS user_id, COUNT(*)::bigint AS challenges_shared
    FROM public.shared_quizzes AS sq
    GROUP BY sq.creator_id
  ),
  exports AS (
    SELECT
      ev.user_id,
      COUNT(*) FILTER (WHERE ev.kind = 'quiz_export')::bigint AS quiz_exports,
      COUNT(*) FILTER (WHERE ev.kind = 'summary_export')::bigint AS summary_exports,
      COUNT(*) FILTER (WHERE ev.kind = 'live_recap_export')::bigint AS live_recap_exports,
      COUNT(*) FILTER (WHERE ev.kind = 'excel_export')::bigint AS excel_exports
    FROM public.export_events AS ev
    GROUP BY ev.user_id
  )
  SELECT
    u.id,
    u.email::text,
    COALESCE(
      NULLIF(TRIM((u.raw_user_meta_data ->> 'full_name')::text), ''),
      NULLIF(TRIM((u.raw_user_meta_data ->> 'name')::text), ''),
      NULLIF(TRIM((u.raw_user_meta_data ->> 'display_name')::text), ''),
      split_part(u.email, '@', 1)
    ) AS display_name,
    COALESCE(doc.documents_count, 0) AS documents_count,
    COALESCE(quiz.quizzes_generated, 0) AS quizzes_generated,
    COALESCE(revision.revisions_generated, 0) AS revisions_generated,
    up.plan,
    COALESCE(shared.challenges_shared, 0) AS challenges_shared,
    COALESCE(exports.quiz_exports, 0) AS quiz_exports,
    COALESCE(exports.summary_exports, 0) AS summary_exports,
    COALESCE(exports.live_recap_exports, 0) AS live_recap_exports,
    COALESCE(exports.excel_exports, 0) AS excel_exports,
    u.created_at,
    COALESCE(st.current_streak, 0) AS current_streak,
    COALESCE(st.longest_streak, 0) AS longest_streak,
    st.last_active_date
  FROM auth.users u
  LEFT JOIN doc ON doc.user_id = u.id
  LEFT JOIN quiz ON quiz.user_id = u.id
  LEFT JOIN revision ON revision.user_id = u.id
  LEFT JOIN shared ON shared.user_id = u.id
  LEFT JOIN exports ON exports.user_id = u.id
  LEFT JOIN public.user_streaks st ON st.user_id = u.id
  LEFT JOIN public.user_plans up ON up.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_list_user_activity IS 'Vue administrateur des utilisateurs enrichie avec la flamme (streak).';

GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_streak_reminder_sent(uuid, date, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_user_activity() TO service_role, authenticated;

COMMIT;
