-- Migration: Quiz scoring schema (quiz_attempts + quiz_answers + RLS)
-- Date: 2025-11-06
-- Safe to run multiple times (guards where needed)

-- Extensions (for gen_random_uuid if ever needed elsewhere)
create extension if not exists pgcrypto;

-- =============================================
-- Table: quiz_attempts
-- =============================================
create table if not exists public.quiz_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  total_questions integer not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  context jsonb -- optional: {"document_path":"...","user_query":"...","num_questions":5}
);

-- basic index for common queries
create index if not exists idx_quiz_attempts_user_created_at on public.quiz_attempts (user_id, created_at);

-- enable RLS
alter table public.quiz_attempts enable row level security;

-- Policies (create with guards to avoid re-creation errors)
-- Select: user can read own attempts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_attempts' AND policyname = 'quiz_attempts_select_own'
  ) THEN
    CREATE POLICY "quiz_attempts_select_own" ON public.quiz_attempts
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END$$;

-- Insert: user can insert attempts for self
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_attempts' AND policyname = 'quiz_attempts_insert_own'
  ) THEN
    CREATE POLICY "quiz_attempts_insert_own" ON public.quiz_attempts
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- Update: by default disallow, but allow owner to update their attempt (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_attempts' AND policyname = 'quiz_attempts_update_own'
  ) THEN
    CREATE POLICY "quiz_attempts_update_own" ON public.quiz_attempts
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- Delete: optionally allow owner to delete their attempt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_attempts' AND policyname = 'quiz_attempts_delete_own'
  ) THEN
    CREATE POLICY "quiz_attempts_delete_own" ON public.quiz_attempts
      FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END$$;

-- =============================================
-- Table: quiz_answers (detailed per-question answers)
-- =============================================
create table if not exists public.quiz_answers (
  attempt_id bigint not null references public.quiz_attempts(id) on delete cascade,
  question_index integer not null,
  answer text,
  is_correct boolean not null,
  question text,
  correct_answer text,
  justification text,
  created_at timestamptz not null default now(),
  primary key (attempt_id, question_index)
);

create index if not exists idx_quiz_answers_attempt on public.quiz_answers (attempt_id);

alter table public.quiz_answers enable row level security;

-- Answers: select only if the attempt belongs to current user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_answers' AND policyname = 'quiz_answers_select_own_attempt'
  ) THEN
    CREATE POLICY "quiz_answers_select_own_attempt" ON public.quiz_answers
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.quiz_attempts a
          WHERE a.id = quiz_answers.attempt_id
            AND a.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Answers: insert only if the attempt belongs to current user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_answers' AND policyname = 'quiz_answers_insert_own_attempt'
  ) THEN
    CREATE POLICY "quiz_answers_insert_own_attempt" ON public.quiz_answers
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.quiz_attempts a
          WHERE a.id = quiz_answers.attempt_id
            AND a.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Answers: optionally allow update/delete by owner (not always needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_answers' AND policyname = 'quiz_answers_update_own_attempt'
  ) THEN
    CREATE POLICY "quiz_answers_update_own_attempt" ON public.quiz_answers
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.quiz_attempts a
          WHERE a.id = quiz_answers.attempt_id
            AND a.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.quiz_attempts a
          WHERE a.id = quiz_answers.attempt_id
            AND a.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_answers' AND policyname = 'quiz_answers_delete_own_attempt'
  ) THEN
    CREATE POLICY "quiz_answers_delete_own_attempt" ON public.quiz_answers
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.quiz_attempts a
          WHERE a.id = quiz_answers.attempt_id
            AND a.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- =============================================
-- Realtime publication (ensure tables are in publication)
-- Note: publication 'supabase_realtime' exists by default in Supabase projects
DO $$
BEGIN
  -- Attempt to add tables to publication; ignore if already present
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts';
  EXCEPTION WHEN others THEN
    -- ignore
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers';
  EXCEPTION WHEN others THEN
    -- ignore
    NULL;
  END;
END$$;
