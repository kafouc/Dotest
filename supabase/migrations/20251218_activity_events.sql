-- Table pour tracker toutes les activités utilisateur en temps réel
CREATE TABLE IF NOT EXISTS public.activity_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activity_events IS 'Journal des activités utilisateur pour le dashboard admin temps réel';
COMMENT ON COLUMN public.activity_events.event_type IS 'Type d''événement: quiz_generated, summary_generated, flashcard_generated, document_uploaded, document_processed, challenge_created, challenge_completed, etc.';
COMMENT ON COLUMN public.activity_events.event_data IS 'Données contextuelles de l''événement (document_path, score, etc.)';

CREATE INDEX IF NOT EXISTS idx_activity_events_occurred_at ON public.activity_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id ON public.activity_events (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON public.activity_events (event_type);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire, service_role peut insérer
CREATE POLICY activity_events_insert_service
  ON public.activity_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY activity_events_select_admin
  ON public.activity_events
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Fonction pour récupérer les activités récentes
CREATE OR REPLACE FUNCTION public.get_recent_activities(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  user_id uuid,
  user_email text,
  event_type text,
  event_data jsonb,
  occurred_at timestamptz
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
  SELECT
    ae.id,
    ae.user_id,
    u.email::text AS user_email,
    ae.event_type,
    ae.event_data,
    ae.occurred_at
  FROM public.activity_events ae
  LEFT JOIN auth.users u ON u.id = ae.user_id
  ORDER BY ae.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_recent_activities IS 'Retourne les activités récentes avec les emails utilisateurs pour le dashboard admin';

-- Fonction pour les statistiques d'activité par type
CREATE OR REPLACE FUNCTION public.get_activity_stats(
  p_since timestamptz DEFAULT now() - interval '24 hours'
)
RETURNS TABLE (
  event_type text,
  event_count bigint,
  unique_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ae.event_type,
    COUNT(*)::bigint AS event_count,
    COUNT(DISTINCT ae.user_id)::bigint AS unique_users
  FROM public.activity_events ae
  WHERE ae.occurred_at >= p_since
  GROUP BY ae.event_type
  ORDER BY event_count DESC;
END;
$$;

COMMENT ON FUNCTION public.get_activity_stats IS 'Retourne les statistiques d''activité par type d''événement';
