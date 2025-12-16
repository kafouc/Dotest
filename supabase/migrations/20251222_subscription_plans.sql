-- Subscription plans table and defaults
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('freemium','partial','pro')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.user_plans IS 'Plan d''abonnement actuel pour chaque utilisateur.';
COMMENT ON COLUMN public.user_plans.plan IS 'Valeurs possibles: freemium, partial, pro.';

CREATE OR REPLACE FUNCTION public.set_updated_at_user_plans()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_plans_updated_at ON public.user_plans;
CREATE TRIGGER trg_user_plans_updated_at
BEFORE UPDATE ON public.user_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_user_plans();

-- Automatically create freemium plan when a new user signs up (except admin seeded manually)
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan, assigned_by, metadata)
  VALUES (NEW.id,
          CASE WHEN lower(NEW.email) = 'sheetofpaper@outlook.fr' THEN 'pro' ELSE 'freemium' END,
          NULL,
          jsonb_build_object('source','signup-default'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_users_default_plan ON auth.users;
CREATE TRIGGER trg_users_default_plan
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_plan();

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

-- Policies: user can read own plan, service can manage all, admins can update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_plans' AND policyname = 'user_plans_select_self'
  ) THEN
    CREATE POLICY user_plans_select_self
      ON public.user_plans
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_plans' AND policyname = 'user_plans_insert_service'
  ) THEN
    CREATE POLICY user_plans_insert_service
      ON public.user_plans
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()) OR auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_plans' AND policyname = 'user_plans_update_admin'
  ) THEN
    CREATE POLICY user_plans_update_admin
      ON public.user_plans
      FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()) OR auth.role() = 'service_role')
      WITH CHECK (public.is_admin(auth.uid()) OR auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_plans' AND policyname = 'user_plans_delete_admin'
  ) THEN
    CREATE POLICY user_plans_delete_admin
      ON public.user_plans
      FOR DELETE
      TO authenticated
      USING (public.is_admin(auth.uid()) OR auth.role() = 'service_role');
  END IF;
END$$;

-- Helper function to set plan with permissions check
CREATE OR REPLACE FUNCTION public.set_user_plan(p_user_id uuid, p_plan text, p_assigned_by uuid DEFAULT NULL)
RETURNS public.user_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_plan text := lower(trim(p_plan));
  v_caller uuid := auth.uid();
BEGIN
  IF v_plan NOT IN ('freemium','partial','pro') THEN
    RAISE EXCEPTION 'Plan inconnu: %', p_plan;
  END IF;

  IF auth.role() <> 'service_role' AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_plans (user_id, plan, assigned_by, metadata)
  VALUES (p_user_id, v_plan, COALESCE(p_assigned_by, v_caller), jsonb_build_object('source','manual'))
  ON CONFLICT (user_id)
  DO UPDATE SET
    plan = EXCLUDED.plan,
    assigned_at = CASE WHEN public.user_plans.plan = EXCLUDED.plan THEN public.user_plans.assigned_at ELSE now() END,
    assigned_by = COALESCE(EXCLUDED.assigned_by, p_assigned_by, v_caller),
    updated_at = now();

  RETURN (SELECT * FROM public.user_plans WHERE user_id = p_user_id);
END;
$$;

COMMENT ON FUNCTION public.set_user_plan(uuid, text, uuid) IS 'Définit le plan d''un utilisateur (admin ou service seulement).';

GRANT EXECUTE ON FUNCTION public.set_user_plan(uuid, text, uuid) TO authenticated, service_role;

-- Seed existing users: default freemium except admin
INSERT INTO public.user_plans (user_id, plan, assigned_at, assigned_by, metadata)
SELECT u.id,
       CASE WHEN lower(u.email) = 'sheetofpaper@outlook.fr' THEN 'pro' ELSE 'freemium' END AS plan,
       now(),
       NULL,
       jsonb_build_object('source','initial-seed')
FROM auth.users AS u
ON CONFLICT (user_id) DO UPDATE
SET plan = EXCLUDED.plan,
    assigned_at = now(),
    metadata = EXCLUDED.metadata;

COMMIT;
