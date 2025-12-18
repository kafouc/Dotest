-- Admin & analytics metrics schema
BEGIN;

-- Table to store explicit admin users (referencing Supabase auth)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_users IS 'Liste blanche des utilisateurs administrateurs.';

-- Helper function used by RLS policies to validate admin access
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = COALESCE(p_user_id, auth.uid())
  );
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Retourne true si l''utilisateur est administrateur (via admin_users).';

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.admin_users
SET role = COALESCE(role, 'owner'),
    scopes = COALESCE(scopes, '{}'::text[]),
    updated_at = COALESCE(updated_at, now());

ALTER TABLE public.admin_users
  ALTER COLUMN role SET DEFAULT 'owner',
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN scopes SET DEFAULT '{}'::text[],
  ALTER COLUMN scopes SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.admin_users'::regclass
      AND conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE public.admin_users DROP CONSTRAINT admin_users_role_check;
  END IF;
END
$$;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check CHECK (role IN ('owner', 'admin', 'manager', 'viewer'));

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_users'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.admin_users', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY admin_users_select_self
  ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY admin_users_insert_self
  ON public.admin_users
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY admin_users_update_service
  ON public.admin_users
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY admin_users_delete_service
  ON public.admin_users
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Fonction d'agrégation des utilisateurs pour le back-office
CREATE OR REPLACE FUNCTION public.admin_list_user_activity()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  documents_count bigint,
  quizzes_generated bigint,
  revisions_generated bigint,
  created_at timestamptz
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
    u.created_at
  FROM auth.users u
  LEFT JOIN doc ON doc.user_id = u.id
  LEFT JOIN quiz ON quiz.user_id = u.id
  LEFT JOIN revision ON revision.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_list_user_activity IS 'Retourne les utilisateurs avec leurs compteurs (documents, quiz générés, fiches de révision), réservé aux administrateurs.';

-- Raw page view log table (used to derive homepage metrics)
CREATE TABLE IF NOT EXISTS public.page_views (
  id bigserial PRIMARY KEY,
  route text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid,
  visited_at timestamptz NOT NULL DEFAULT now(),
  referrer text,
  user_agent text,
  country text,
  ip_hash text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.page_views IS 'Journal des visites de pages (agrégé ensuite dans les métriques quotidienne).';
COMMENT ON COLUMN public.page_views.ip_hash IS 'Empreinte (hash) optionnelle du client pour analyses anonymisées.';

CREATE INDEX IF NOT EXISTS idx_page_views_visited_at ON public.page_views (visited_at);
CREATE INDEX IF NOT EXISTS idx_page_views_route ON public.page_views (route);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON public.page_views (user_id);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'page_views' AND policyname = 'page_views_insert_authenticated'
  ) THEN
    CREATE POLICY page_views_insert_authenticated
      ON public.page_views
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated' OR auth.uid() IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'page_views' AND policyname = 'page_views_select_admin'
  ) THEN
    CREATE POLICY page_views_select_admin
      ON public.page_views
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

-- Raw AI usage events (per request) feeding the daily aggregation
CREATE TABLE IF NOT EXISTS public.metrics_ai_usage_events (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_tokens bigint DEFAULT 0,
  completion_tokens bigint DEFAULT 0,
  total_tokens bigint DEFAULT 0,
  latency_ms integer,
  cost numeric(12,4),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.metrics_ai_usage_events IS 'Événements bruts des appels IA (Groq) utilisés pour les agrégations quotidiennes.';

CREATE INDEX IF NOT EXISTS idx_metrics_ai_usage_events_occurred_at
  ON public.metrics_ai_usage_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_metrics_ai_usage_events_provider_model
  ON public.metrics_ai_usage_events (provider, model);

ALTER TABLE public.metrics_ai_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'metrics_ai_usage_events' AND policyname = 'metrics_ai_usage_events_insert_service'
  ) THEN
    CREATE POLICY metrics_ai_usage_events_insert_service
      ON public.metrics_ai_usage_events
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role' OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'metrics_ai_usage_events' AND policyname = 'metrics_ai_usage_events_select_admin'
  ) THEN
    CREATE POLICY metrics_ai_usage_events_select_admin
      ON public.metrics_ai_usage_events
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

-- Daily AI usage metrics (Groq)
CREATE TABLE IF NOT EXISTS public.metrics_daily_usage (
  usage_date date NOT NULL,
  provider text NOT NULL,
  model text NOT NULL DEFAULT '',
  total_requests integer NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost numeric(12,4) NOT NULL DEFAULT 0,
  average_latency_ms integer,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usage_date, provider, model)
);

COMMENT ON TABLE public.metrics_daily_usage IS 'Agrégations quotidiennes des appels IA (Groq).';

-- Daily documents metrics (imports & processing)
CREATE TABLE IF NOT EXISTS public.metrics_daily_documents (
  usage_date date PRIMARY KEY,
  documents_imported integer NOT NULL DEFAULT 0,
  documents_processed integer NOT NULL DEFAULT 0,
  sections_created integer NOT NULL DEFAULT 0,
  unique_uploaders integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.metrics_daily_documents IS 'Synthèse quotidienne des documents importés et des segments générés.';

-- Daily users metrics (growth & engagement)
CREATE TABLE IF NOT EXISTS public.metrics_daily_users (
  usage_date date PRIMARY KEY,
  new_users integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  active_users_7d integer NOT NULL DEFAULT 0,
  active_users_30d integer NOT NULL DEFAULT 0,
  churned_users integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.metrics_daily_users IS 'Statistiques quotidiennes des utilisateurs (acquisition et rétention).';

-- Ensure updated_at stays in sync (function may already exist elsewhere)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_metrics_daily_usage_updated_at'
  ) THEN
    CREATE TRIGGER trg_metrics_daily_usage_updated_at
    BEFORE UPDATE ON public.metrics_daily_usage
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_metrics_daily_documents_updated_at'
  ) THEN
    CREATE TRIGGER trg_metrics_daily_documents_updated_at
    BEFORE UPDATE ON public.metrics_daily_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_metrics_daily_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_metrics_daily_users_updated_at
    BEFORE UPDATE ON public.metrics_daily_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

ALTER TABLE public.metrics_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'metrics_daily_usage' AND policyname = 'metrics_daily_usage_select_admin'
  ) THEN
    CREATE POLICY metrics_daily_usage_select_admin
      ON public.metrics_daily_usage
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'metrics_daily_documents' AND policyname = 'metrics_daily_documents_select_admin'
  ) THEN
    CREATE POLICY metrics_daily_documents_select_admin
      ON public.metrics_daily_documents
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'metrics_daily_users' AND policyname = 'metrics_daily_users_select_admin'
  ) THEN
    CREATE POLICY metrics_daily_users_select_admin
      ON public.metrics_daily_users
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

-- Derived view for homepage (vitrine) daily views
CREATE OR REPLACE VIEW public.metrics_homepage_views AS
SELECT
  date_trunc('day', pv.visited_at)::date AS usage_date,
  COUNT(*) AS view_count
FROM public.page_views pv
WHERE pv.route IN ('/', '/vitrine')
GROUP BY 1
ORDER BY 1;

COMMENT ON VIEW public.metrics_homepage_views IS 'Vue quotidienne des visites de la page vitrine (homepage).';

-- Function to aggregate metrics for a given date (default: previous UTC day)
CREATE OR REPLACE FUNCTION public.run_daily_metrics_aggregation(p_target_date date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_date date := COALESCE(p_target_date, ((now() AT TIME ZONE 'UTC')::date - 1));
  v_next date := v_date + 1;
  v_documents_imported integer := 0;
  v_documents_processed integer := 0;
  v_sections_created integer := 0;
  v_unique_uploaders integer := 0;
  v_new_users integer := 0;
  v_active_users integer := 0;
  v_active_users_7d integer := 0;
  v_active_users_30d integer := 0;
BEGIN
  -- Documents metrics
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE d.created_at >= v_date AND d.created_at < v_next),
      COUNT(*) FILTER (WHERE d.status = 'completed' AND COALESCE(d.updated_at, d.created_at) >= v_date AND COALESCE(d.updated_at, d.created_at) < v_next),
      COUNT(DISTINCT d.user_id) FILTER (WHERE d.created_at >= v_date AND d.created_at < v_next)
    INTO v_documents_imported, v_documents_processed, v_unique_uploaders
    FROM public.documents d;
  EXCEPTION
    WHEN undefined_table THEN
      v_documents_imported := 0;
      v_documents_processed := 0;
      v_unique_uploaders := 0;
    WHEN undefined_column THEN
      -- Fallback if updated_at column is missing
      SELECT
        COUNT(*) FILTER (WHERE d.created_at >= v_date AND d.created_at < v_next),
        COUNT(*) FILTER (WHERE d.status = 'completed' AND d.created_at >= v_date AND d.created_at < v_next),
        COUNT(DISTINCT d.user_id) FILTER (WHERE d.created_at >= v_date AND d.created_at < v_next)
      INTO v_documents_imported, v_documents_processed, v_unique_uploaders
      FROM public.documents d;
  END;

  BEGIN
    SELECT COUNT(*)
    INTO v_sections_created
    FROM public.document_sections ds
    WHERE ds.created_at >= v_date AND ds.created_at < v_next;
  EXCEPTION
    WHEN undefined_table THEN
      v_sections_created := 0;
    WHEN undefined_column THEN
      v_sections_created := 0;
  END;

  INSERT INTO public.metrics_daily_documents (usage_date, documents_imported, documents_processed, sections_created, unique_uploaders)
  VALUES (v_date, v_documents_imported, v_documents_processed, v_sections_created, v_unique_uploaders)
  ON CONFLICT (usage_date)
  DO UPDATE SET
    documents_imported = EXCLUDED.documents_imported,
    documents_processed = EXCLUDED.documents_processed,
    sections_created = EXCLUDED.sections_created,
    unique_uploaders = EXCLUDED.unique_uploaders,
    updated_at = now();

  -- Users metrics (new signups & activity based on page views)
  BEGIN
    SELECT COUNT(*)
    INTO v_new_users
    FROM auth.users u
    WHERE u.created_at >= v_date AND u.created_at < v_next;
  EXCEPTION
    WHEN undefined_table THEN
      v_new_users := 0;
    WHEN insufficient_privilege THEN
      v_new_users := 0;
  END;

  SELECT COUNT(DISTINCT pv.user_id) FILTER (WHERE pv.user_id IS NOT NULL)
  INTO v_active_users
  FROM public.page_views pv
  WHERE pv.visited_at >= v_date AND pv.visited_at < v_next;

  SELECT COUNT(DISTINCT pv.user_id) FILTER (WHERE pv.user_id IS NOT NULL)
  INTO v_active_users_7d
  FROM public.page_views pv
  WHERE pv.visited_at >= v_date - 6 AND pv.visited_at < v_next;

  SELECT COUNT(DISTINCT pv.user_id) FILTER (WHERE pv.user_id IS NOT NULL)
  INTO v_active_users_30d
  FROM public.page_views pv
  WHERE pv.visited_at >= v_date - 29 AND pv.visited_at < v_next;

  INSERT INTO public.metrics_daily_users (usage_date, new_users, active_users, active_users_7d, active_users_30d, churned_users)
  VALUES (v_date, v_new_users, v_active_users, v_active_users_7d, v_active_users_30d, 0)
  ON CONFLICT (usage_date)
  DO UPDATE SET
    new_users = EXCLUDED.new_users,
    active_users = EXCLUDED.active_users,
    active_users_7d = EXCLUDED.active_users_7d,
    active_users_30d = EXCLUDED.active_users_30d,
    churned_users = EXCLUDED.churned_users,
    updated_at = now();

  -- AI usage metrics aggregated from raw events
  DELETE FROM public.metrics_daily_usage m
  WHERE m.usage_date = v_date;

  INSERT INTO public.metrics_daily_usage (usage_date, provider, model, total_requests, prompt_tokens, completion_tokens, total_tokens, estimated_cost, average_latency_ms, metadata)
  SELECT
    v_date,
    e.provider,
    e.model,
    COUNT(*) AS total_requests,
    COALESCE(SUM(e.prompt_tokens), 0) AS prompt_tokens,
    COALESCE(SUM(e.completion_tokens), 0) AS completion_tokens,
    COALESCE(SUM(e.total_tokens), 0) AS total_tokens,
    COALESCE(SUM(e.cost), 0)::numeric(12,4) AS estimated_cost,
    CASE
      WHEN COUNT(e.latency_ms) = 0 THEN NULL
      ELSE ROUND(AVG(e.latency_ms)::numeric)
    END AS average_latency_ms,
    NULL::jsonb AS metadata
  FROM public.metrics_ai_usage_events e
  WHERE e.occurred_at >= v_date AND e.occurred_at < v_next
  GROUP BY e.provider, e.model;
END;
$$;

COMMENT ON FUNCTION public.run_daily_metrics_aggregation(date) IS 'Recalcule toutes les métriques quotidiennes pour la date cible (par défaut la veille UTC).';

-- Ajout de l'administrateur principal
INSERT INTO public.admin_users (user_id, role)
VALUES ('b30aa910-e3f5-41da-ac30-5426c1ed2c34', 'owner')
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
