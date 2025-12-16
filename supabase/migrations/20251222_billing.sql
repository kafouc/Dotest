-- Billing tables for Stripe integration
BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE NOT NULL,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text NOT NULL DEFAULT 'freemium' CHECK (plan IN ('freemium','partial','pro')),
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.billing_customers IS 'Mapping entre utilisateurs et clients Stripe.';

CREATE OR REPLACE FUNCTION public.set_updated_at_billing_customers()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_customers_updated_at ON public.billing_customers;
CREATE TRIGGER trg_billing_customers_updated_at
BEFORE UPDATE ON public.billing_customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_billing_customers();

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_customers' AND policyname = 'billing_customers_select_self'
  ) THEN
    CREATE POLICY billing_customers_select_self
      ON public.billing_customers
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_customers' AND policyname = 'billing_customers_insert_admin'
  ) THEN
    CREATE POLICY billing_customers_insert_admin
      ON public.billing_customers
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()) OR auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_customers' AND policyname = 'billing_customers_update_admin'
  ) THEN
    CREATE POLICY billing_customers_update_admin
      ON public.billing_customers
      FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()) OR auth.role() = 'service_role')
      WITH CHECK (public.is_admin(auth.uid()) OR auth.role() = 'service_role');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.get_or_create_stripe_customer(p_user_id uuid, p_email text)
RETURNS public.billing_customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customer public.billing_customers;
BEGIN
  SELECT * INTO v_customer FROM public.billing_customers WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN v_customer;
  END IF;

  INSERT INTO public.billing_customers (user_id, stripe_customer_id, plan, metadata)
  VALUES (p_user_id, concat('tmp_', encode(gen_random_bytes(8), 'hex')), 'freemium', jsonb_build_object('email', p_email))
  RETURNING * INTO v_customer;

  RETURN v_customer;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_stripe_customer(uuid, text) IS 'Retourne ou crée une entrée billing_customers (stripe_customer_id à mettre à jour côté serveur).';

GRANT EXECUTE ON FUNCTION public.get_or_create_stripe_customer(uuid, text) TO authenticated, service_role;

COMMIT;
