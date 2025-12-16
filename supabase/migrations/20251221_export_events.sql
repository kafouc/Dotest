-- Table de suivi des exports (quiz, fiches, recaps, Excel, défis)
BEGIN;

CREATE TABLE IF NOT EXISTS public.export_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN (
    'challenge_share',
    'quiz_export',
    'summary_export',
    'live_recap_export',
    'excel_export'
  )),
  context text,
  document_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.export_events IS 'Événements d''export (défis partagés, quiz, fiches, recaps live, Excel).';
COMMENT ON COLUMN public.export_events.kind IS 'Type d''export: challenge_share, quiz_export, summary_export, live_recap_export, excel_export.';

ALTER TABLE public.export_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'export_events' AND policyname = 'export_events_insert_authenticated'
  ) THEN
    CREATE POLICY export_events_insert_authenticated
      ON public.export_events
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'export_events' AND policyname = 'export_events_select_admin'
  ) THEN
    CREATE POLICY export_events_select_admin
      ON public.export_events
      FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'export_events' AND policyname = 'export_events_select_self'
  ) THEN
    CREATE POLICY export_events_select_self
      ON public.export_events
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END$$;

COMMIT;
