import Stripe from 'stripe';
import { getSupabaseAdminClient } from './subscriptions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

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

/**
 * Événements Stripe que le webhook /api/billing/webhook sait traiter. Ils doivent tous être activés sur le point de terminaison
 * dans Stripe (Développeurs > Webhooks) : `npm run stripe:webhook-events` vérifie et, avec --apply, complète la liste.
 */
export const STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
] as const;

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

type PlanPriceSources = {
  priceId?: string | null;
  lookupKey?: string | null;
  productId?: string | null;
};

const planPriceConfig: Record<BillingPlan, PlanPriceSources> = {
  freemium: {},
  partial: {
    priceId: process.env.STRIPE_PRICE_PARTIAL,
    lookupKey: process.env.STRIPE_PRICE_PARTIAL_LOOKUP_KEY,
    productId: process.env.STRIPE_PRODUCT_PARTIAL_ID,
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO,
    lookupKey: process.env.STRIPE_PRICE_PRO_LOOKUP_KEY,
    productId: process.env.STRIPE_PRODUCT_PRO_ID,
  },
};

const sharedProductId = process.env.STRIPE_PRODUCT_ID;

const priceIdCache: Partial<Record<BillingPlan, string>> = {};

export async function resolvePlanFromPrice(priceId: string | null): Promise<BillingPlan> {
  if (!priceId) return 'freemium';

  if (priceId === process.env.STRIPE_PRICE_PARTIAL || priceId === priceIdCache.partial) {
    return 'partial';
  }
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === priceIdCache.pro) {
    return 'pro';
  }

  const stripe = getStripe();
  try {
    const price = await stripe.prices.retrieve(priceId);
    const lookup = (price.lookup_key ?? '').toLowerCase();
    if (lookup === 'partial' || lookup === 'pro') {
      priceIdCache[lookup] = price.id;
      return lookup as BillingPlan;
    }

    const metadataPlan = (price.metadata?.plan ?? '').toLowerCase();
    if (metadataPlan === 'partial' || metadataPlan === 'pro') {
      priceIdCache[metadataPlan] = price.id;
      return metadataPlan as BillingPlan;
    }
  } catch (error) {
    if (!isStripeMissingResource(error)) {
      throw error;
    }
    logger.warn(`[billing] Impossible de résoudre le plan pour le prix ${priceId}.`, error);
  }

  return 'freemium';
}

function isStripeMissingResource(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeError && error.code === 'resource_missing';
}

async function resolveStripePriceId(stripe: Stripe, plan: BillingPlan): Promise<string> {
  if (plan === 'freemium') {
    throw new Error('Aucun prix Stripe requis pour le plan freemium.');
  }

  if (priceIdCache[plan]) {
    return priceIdCache[plan] as string;
  }

  const config = planPriceConfig[plan];

  if (config?.priceId) {
    try {
      const price = await stripe.prices.retrieve(config.priceId);
      if (price.active) {
        priceIdCache[plan] = price.id;
        return price.id;
      }
      logger.warn(`[billing] Prix ${config.priceId} inactif pour le plan ${plan}.`);
    } catch (error) {
      if (!isStripeMissingResource(error)) {
        throw error;
      }
      logger.warn(`[billing] Prix ${config.priceId} introuvable pour le plan ${plan}, tentative de repli.`, error);
    }
  }

  const lookupCandidates = [config?.lookupKey, plan]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, array) => array.indexOf(value) === index);

  if (lookupCandidates.length) {
    const { data } = await stripe.prices.list({
      lookup_keys: lookupCandidates,
      active: true,
      limit: lookupCandidates.length,
    });

    const match = data.find((price) => price.lookup_key && lookupCandidates.includes(price.lookup_key));
    if (match) {
      priceIdCache[plan] = match.id;
      return match.id;
    }
  }

  const productCandidates = [config?.productId, sharedProductId]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, array) => array.indexOf(value) === index);

  for (const productId of productCandidates) {
    const { data } = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 10,
    });

    let match = data.find((price) => (price.metadata?.plan ?? '').toLowerCase() === plan);
    if (!match && data.length === 1 && productId === config?.productId) {
      match = data[0];
    }

    if (match) {
      priceIdCache[plan] = match.id;
      return match.id;
    }
  }

  throw new Error(`Aucun prix Stripe actif n'est configuré pour le plan ${plan}.`);
}

/**
 * Statuts qui donnent accès au forfait payant.
 * `past_due` (prélèvement échoué, Stripe réessaie pendant quelques jours) garde l'accès : c'est la période de grâce.
 * `unpaid` (Stripe a abandonné les relances) ne le garde plus.
 */
export function shouldKeepPaidPlan(status: Stripe.Subscription.Status | null | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

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

/**
 * Options de TVA et de facturation du paiement. Activées par STRIPE_AUTOMATIC_TAX=true une fois Stripe Tax configuré
 * dans le tableau de bord Stripe (adresse de l'entreprise, enregistrement TVA, prix en « taxe incluse » ou « hors taxe »).
 * Sans cela, la facture ne contient aucune ligne de TVA : voir docs/FACTURATION.md.
 */
export function checkoutTaxOptions(env: Record<string, string | undefined> = process.env): Partial<Stripe.Checkout.SessionCreateParams> {
  const options: Partial<Stripe.Checkout.SessionCreateParams> = {};
  if (env.STRIPE_AUTOMATIC_TAX === 'true') {
    options.automatic_tax = { enabled: true };
    options.billing_address_collection = 'required';
    options.tax_id_collection = { enabled: true };
    // Obligatoire avec tax_id_collection quand le client Stripe existe déjà
    options.customer_update = { name: 'auto', address: 'auto' };
  }
  // Acceptation des CGV avant paiement (l'URL des CGV doit être renseignée dans le tableau de bord Stripe)
  if (env.STRIPE_REQUIRE_TERMS === 'true') {
    options.consent_collection = { terms_of_service: 'required' };
  }
  return options;
}

export async function createCheckoutSession(opts: {
  userId: string;
  plan: BillingPlan;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }>
{
  const customerRow = await ensureStripeCustomer(opts.userId, opts.email);
  const stripe = getStripe();

  const fallbackCheckoutUrl = opts.plan === 'partial'
    ? process.env.NEXT_PUBLIC_STRIPE_PARTIAL_CHECKOUT_URL
    : undefined;

  let priceId: string;
  try {
    priceId = await resolveStripePriceId(stripe, opts.plan);
  } catch (error) {
    if (fallbackCheckoutUrl) {
      logger.warn('[billing] Fallback vers le lien de checkout préconfiguré pour le plan partiel.', error);
      return { url: fallbackCheckoutUrl };
    }
    throw error;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerRow.stripe_customer_id,
    client_reference_id: opts.userId,
    metadata: {
      supabase_user_id: opts.userId,
      target_plan: opts.plan,
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    locale: 'fr',
    ...checkoutTaxOptions(),
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

/**
 * Résilie immédiatement tous les abonnements d'un client Stripe (suppression de compte).
 * Le client et ses factures sont conservés chez Stripe : la loi impose de garder les factures 10 ans.
 */
export async function cancelStripeSubscriptionsForAccount(customerId: string): Promise<void> {
  const stripe = getStripe();
  try {
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    for (const subscription of subscriptions.data) {
      if (subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired') {
        await stripe.subscriptions.cancel(subscription.id);
      }
    }
    await stripe.customers.update(customerId, { metadata: { account_deleted_at: new Date().toISOString() } });
  } catch (error) {
    // Client déjà supprimé côté Stripe : rien à résilier
    if (isStripeMissingResource(error)) return;
    throw error;
  }
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

export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  const admin = await getAdminClient();
  const { data, error } = await admin
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .single();

  if (error) {
    if (error.code === 'PGRST116' || error.code === '406') {
      return false;
    }
    throw error;
  }

  return Boolean(data?.event_id);
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  const admin = await getAdminClient();
  await admin
    .from('stripe_webhook_events')
    .upsert({ event_id: eventId }, { onConflict: 'event_id' });
}

export async function syncUserPlanFromStripe(userId: string): Promise<BillingPlan> {
  const admin = await getAdminClient();
  const { data: customerRow, error } = await admin
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (error || !customerRow?.stripe_customer_id) {
    throw new Error('Client Stripe introuvable pour cet utilisateur.');
  }

  const stripe = getStripe();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerRow.stripe_customer_id,
    status: 'all',
    limit: 1,
  });

  const subscription = subscriptions.data[0] ?? null;
  const status = subscription?.status ?? null;
  const priceId = subscription?.items.data[0]?.price?.id ?? null;
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const targetPlan = subscription?.metadata?.target_plan ?? null;
  const resolvedPlan = (targetPlan === 'partial' || targetPlan === 'pro')
    ? targetPlan
    : await resolvePlanFromPrice(priceId);
  const plan = shouldKeepPaidPlan(status) ? resolvedPlan : 'freemium';

  await admin.from('billing_customers').upsert({
    user_id: userId,
    stripe_customer_id: customerRow.stripe_customer_id,
    stripe_subscription_id: subscription?.id ?? null,
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

  return plan;
}

/** Resynchronise le forfait à partir de l'identifiant client Stripe (événements de facturation). */
export async function syncPlanForCustomer(customerId: string): Promise<BillingPlan | null> {
  const admin = await getAdminClient();
  const { data } = await admin.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).single();
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (!userId) return null;
  return syncUserPlanFromStripe(userId);
}

export async function syncPlanFromStripe(event: Stripe.Event): Promise<void> {
  const admin = await getAdminClient();

  // Paiement asynchrone (prélèvement SEPA…) confirmé après la fin du paiement : le forfait est accordé à ce moment-là
  if (event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    if (customerId) await syncPlanForCustomer(customerId);
    return;
  }

  // Factures : le résultat d'un prélèvement (réussi, échoué) change le statut de l'abonnement
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    if (customerId) await syncPlanForCustomer(customerId);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'subscription') return;

    let userId = session.client_reference_id ?? session.metadata?.supabase_user_id ?? null;
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    if (!userId && customerId) {
      const { data } = await admin
        .from('billing_customers')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();
      userId = data?.user_id ?? null;
    }

    if (!userId) return;

    const stripe = getStripe();
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    const subscription = subscriptionId
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : null;

    const priceId = subscription?.items.data[0]?.price?.id ?? null;
    const status = subscription?.status ?? null;
    const periodEnd = subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const targetPlan = session.metadata?.target_plan ?? null;
    const resolvedPlan = (targetPlan === 'partial' || targetPlan === 'pro')
      ? targetPlan
      : await resolvePlanFromPrice(priceId);
    // Le plan n'est accordé que si le paiement est réellement acquis.
    const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    const plan = paid && shouldKeepPaidPlan(status) ? resolvedPlan : 'freemium';

    await admin.from('billing_customers').upsert({
      user_id: userId,
      stripe_customer_id: customerId ?? session.customer?.toString() ?? '',
      stripe_subscription_id: subscription?.id ?? subscriptionId,
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

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    // Les événements Stripe peuvent arriver dans le désordre : un ancien « updated » ne doit pas écraser l'état actuel.
    // On relit donc l'abonnement chez Stripe (source de vérité) ; en cas d'échec, on retombe sur le contenu de l'événement.
    const payloadSubscription = event.data.object as Stripe.Subscription;
    let subscription = payloadSubscription;
    try {
      subscription = await getStripe().subscriptions.retrieve(payloadSubscription.id);
    } catch (error) {
      logger.warn('[billing] relecture de l’abonnement impossible, utilisation de l’événement', error instanceof Error ? error : { error: String(error) });
    }
    let userId = subscription.metadata?.supabase_user_id ?? null;
    const targetPlan = subscription.metadata?.target_plan ?? null;
    const customerId = subscription.customer as string;
    if (!userId && customerId) {
      const { data } = await admin
        .from('billing_customers')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();
      userId = data?.user_id ?? null;
    }
    if (!userId) {
      return;
    }

    const priceId = subscription.items.data[0]?.price?.id ?? null;
    const status = subscription.status;
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
    const resolvedPlan = (targetPlan === 'partial' || targetPlan === 'pro')
      ? targetPlan
      : await resolvePlanFromPrice(priceId);
    // Un abonnement 'incomplete' / 'canceled' / 'incomplete_expired' ne donne aucun accès payant.
    const plan = shouldKeepPaidPlan(status) ? resolvedPlan : 'freemium';

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
    let userId = subscription.metadata?.supabase_user_id ?? null;
    if (!userId && typeof subscription.customer === 'string') {
      const { data } = await admin
        .from('billing_customers')
        .select('user_id')
        .eq('stripe_customer_id', subscription.customer)
        .single();
      userId = data?.user_id ?? null;
    }
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
