import Stripe from 'stripe';
import { getSupabaseAdminClient } from './subscriptions';
import type { SupabaseClient } from '@supabase/supabase-js';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY manquant pour l\'intégration Stripe.');
  }
  stripeClient = new Stripe(secretKey, {
    apiVersion: '2024-06-20',
  });
  return stripeClient;
}

export type BillingPlan = 'freemium' | 'partial' | 'pro';

type BillingCustomerRow = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: BillingPlan;
  subscription_status: string | null;
  current_period_end: string | null;
  metadata: Record<string, unknown> | null;
};

type SupabaseAdmin = SupabaseClient;

async function getAdminClient(): Promise<SupabaseAdmin> {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error('Supabase admin client non disponible. Vérifiez les variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.');
  }
  return client as SupabaseAdmin;
}

export async function ensureStripeCustomer(userId: string, email: string | null): Promise<BillingCustomerRow> {
  const admin = await getAdminClient();
  const { data, error } = await admin
    .from('billing_customers')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      throw error;
    }
  }

  if (data && data.stripe_customer_id && !data.stripe_customer_id.startsWith('tmp_')) {
    return data as BillingCustomerRow;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      supabase_user_id: userId,
    },
  });

  const { data: upserted, error: upsertError } = await admin
    .from('billing_customers')
    .upsert({
      user_id: userId,
      stripe_customer_id: customer.id,
      plan: data?.plan ?? 'freemium',
      metadata: {
        ...(data?.metadata ?? {}),
        email,
      },
    })
    .select()
    .single();

  if (upsertError) {
    throw upsertError;
  }

  return upserted as BillingCustomerRow;
}

export async function createCheckoutSession(opts: {
  userId: string;
  plan: BillingPlan;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }>
{
  const priceIdEnv = opts.plan === 'partial' ? process.env.STRIPE_PRICE_PARTIAL : process.env.STRIPE_PRICE_PRO;
  if (!priceIdEnv) {
    throw new Error('Identifiant de prix Stripe manquant pour ce plan.');
  }

  const customerRow = await ensureStripeCustomer(opts.userId, opts.email);
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerRow.stripe_customer_id,
    line_items: [
      {
        price: priceIdEnv,
        quantity: 1,
      },
    ],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    subscription_data: {
      metadata: {
        supabase_user_id: opts.userId,
        target_plan: opts.plan,
      },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error('Stripe checkout session URL manquante.');
  }

  return { url: session.url };
}

export async function createBillingPortalSession(opts: { userId: string; returnUrl: string; email: string | null; }): Promise<{ url: string }>
{
  const customerRow = await ensureStripeCustomer(opts.userId, opts.email);
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerRow.stripe_customer_id,
    return_url: opts.returnUrl,
  });
  return { url: session.url }; // Stripe guarantee
}

export async function handleStripeWebhook(payload: Buffer, signature: string | undefined): Promise<Stripe.Event> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET manquant.');
  }
  const stripe = getStripe();
  if (!signature) {
    throw new Error('Stripe-Signature header manquant.');
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function syncPlanFromStripe(event: Stripe.Event): Promise<void> {
  const admin = await getAdminClient();

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.supabase_user_id ?? null;
    const targetPlan = subscription.metadata?.target_plan ?? null;
    if (!userId) {
      return;
    }

    const priceId = subscription.items.data[0]?.price?.id ?? null;
    const status = subscription.status;
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
    const plan = (targetPlan === 'partial' || targetPlan === 'pro') ? targetPlan : 'freemium';

    await admin.from('billing_customers').upsert({
      user_id: userId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      subscription_status: status,
      plan,
      current_period_end: periodEnd,
    });

    await admin.rpc('set_user_plan', {
      p_user_id: userId,
      p_plan: plan,
      p_assigned_by: null,
    });
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.supabase_user_id ?? null;
    if (!userId) return;

    await admin.from('billing_customers').upsert({
      user_id: userId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      plan: 'freemium',
      current_period_end: null,
    });

    await admin.rpc('set_user_plan', {
      p_user_id: userId,
      p_plan: 'freemium',
      p_assigned_by: null,
    });
  }
}
