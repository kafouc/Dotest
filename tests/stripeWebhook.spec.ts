import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Doubles : Stripe et base de données ------------------------------------------------
const stripeMock = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn(), list: vi.fn() },
  prices: { retrieve: vi.fn(), list: vi.fn() },
}));
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  lookups: {} as Record<string, Row | null>,
  upserts: [] as { table: string; row: Row }[],
  rpcs: [] as { name: string; args: Row }[],
  processed: new Set<string>(),
}));

const fakeAdmin = {
  from: (table: string) => {
    const state: { eq?: [string, unknown] } = {};
    const api = {
      select: () => api,
      eq: (col: string, val: unknown) => { state.eq = [col, val]; return api; },
      single: async () => {
        if (table === 'stripe_webhook_events') {
          return db.processed.has(String(state.eq?.[1]))
            ? { data: { event_id: state.eq?.[1] }, error: null }
            : { data: null, error: { code: 'PGRST116' } };
        }
        const key = `${table}:${String(state.eq?.[1])}`;
        const row = db.lookups[key] ?? null;
        return row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116' } };
      },
      upsert: async (row: Row) => {
        if (table === 'stripe_webhook_events') db.processed.add(String(row.event_id));
        else db.upserts.push({ table, row });
        return { error: null };
      },
    };
    return api;
  },
  rpc: async (name: string, args: Row) => { db.rpcs.push({ name, args }); return { error: null }; },
};
vi.mock('@/lib/subscriptions', () => ({ getSupabaseAdminClient: () => fakeAdmin }));

import { checkoutTaxOptions, shouldKeepPaidPlan, syncPlanFromStripe } from '@/lib/billing';
import type Stripe from 'stripe';

const event = (type: string, object: unknown, id = `evt_${type}`) => ({ id, type, data: { object } }) as unknown as Stripe.Event;
const subscription = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: 1_900_000_000,
  metadata: { supabase_user_id: 'u1', target_plan: 'pro' }, items: { data: [{ price: { id: 'price_pro' } }] }, ...over,
});
const planGranted = () => db.rpcs.filter((r) => r.name === 'set_user_plan').map((r) => r.args.p_plan);
const lastBillingRow = () => db.upserts.filter((u) => u.table === 'billing_customers').at(-1)?.row;

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
  vi.clearAllMocks();
  const customerRow = { user_id: 'u1', stripe_customer_id: 'cus_1' };
  db.lookups = { 'billing_customers:cus_1': customerRow, 'billing_customers:u1': customerRow };
  db.upserts.length = 0;
  db.rpcs.length = 0;
  db.processed.clear();
  stripeMock.subscriptions.retrieve.mockResolvedValue(subscription());
  stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription()] });
});

describe('forfait selon le statut de l’abonnement', () => {
  it.each([
    ['active', true], ['trialing', true], ['past_due', true],
    ['unpaid', false], ['canceled', false], ['incomplete', false], ['incomplete_expired', false], ['paused', false],
  ])('%s => accès payant : %s', (status, expected) => {
    expect(shouldKeepPaidPlan(status as Stripe.Subscription.Status)).toBe(expected);
  });
});

describe('checkout.session.completed', () => {
  const session = (over: Record<string, unknown> = {}) => ({
    mode: 'subscription', client_reference_id: 'u1', customer: 'cus_1', subscription: 'sub_1',
    payment_status: 'paid', metadata: { supabase_user_id: 'u1', target_plan: 'pro' }, ...over,
  });

  it('accorde le forfait payé après un paiement réussi', async () => {
    await syncPlanFromStripe(event('checkout.session.completed', session()));
    expect(planGranted()).toEqual(['pro']);
    expect(lastBillingRow()).toMatchObject({ user_id: 'u1', plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_1' });
  });

  it('n’accorde RIEN tant que le paiement n’est pas acquis (prélèvement SEPA en attente), puis l’accorde à la confirmation', async () => {
    await syncPlanFromStripe(event('checkout.session.completed', session({ payment_status: 'unpaid' })));
    expect(planGranted()).toEqual(['freemium']);

    await syncPlanFromStripe(event('checkout.session.async_payment_succeeded', session()));
    expect(planGranted()).toEqual(['freemium', 'pro']);
  });

  it('ignore les paiements qui ne sont pas des abonnements', async () => {
    await syncPlanFromStripe(event('checkout.session.completed', session({ mode: 'payment' })));
    expect(db.rpcs).toEqual([]);
  });

  it('retrouve l’utilisateur par le client Stripe quand la référence manque', async () => {
    await syncPlanFromStripe(event('checkout.session.completed', session({ client_reference_id: null, metadata: { target_plan: 'pro' } })));
    expect(lastBillingRow()).toMatchObject({ user_id: 'u1', plan: 'pro' });
  });
});

describe('cycle de vie de l’abonnement', () => {
  it('annulation : retour au forfait gratuit', async () => {
    await syncPlanFromStripe(event('customer.subscription.deleted', subscription({ status: 'canceled' })));
    expect(planGranted()).toEqual(['freemium']);
    expect(lastBillingRow()).toMatchObject({ plan: 'freemium', current_period_end: null });
  });

  it('prélèvement échoué (past_due) : l’accès est conservé pendant la période de relance', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ status: 'past_due' }));
    await syncPlanFromStripe(event('customer.subscription.updated', subscription({ status: 'past_due' })));
    expect(planGranted()).toEqual(['pro']);
  });

  it('abonnement impayé (unpaid) : l’accès payant est retiré', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ status: 'unpaid' }));
    await syncPlanFromStripe(event('customer.subscription.updated', subscription({ status: 'unpaid' })));
    expect(planGranted()).toEqual(['freemium']);
  });

  it('événements dans le désordre : un ancien « active » ne ressuscite pas un abonnement résilié', async () => {
    // L'événement reçu (ancien) dit « active », mais Stripe indique que l'abonnement est aujourd'hui résilié
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ status: 'canceled' }));
    await syncPlanFromStripe(event('customer.subscription.updated', subscription({ status: 'active' })));
    expect(planGranted()).toEqual(['freemium']);
  });

  it('si la relecture chez Stripe échoue, utilise le contenu de l’événement', async () => {
    stripeMock.subscriptions.retrieve.mockRejectedValue(new Error('réseau'));
    await syncPlanFromStripe(event('customer.subscription.updated', subscription({ status: 'active' })));
    expect(planGranted()).toEqual(['pro']);
  });

  it('abonnement d’un client inconnu : aucune écriture', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ customer: 'cus_inconnu', metadata: {} }));
    await syncPlanFromStripe(event('customer.subscription.updated', subscription({ customer: 'cus_inconnu', metadata: {} })));
    expect(db.rpcs).toEqual([]);
  });
});

describe('factures', () => {
  it('échec de paiement : resynchronise sur l’état réel de l’abonnement (période de grâce)', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription({ status: 'past_due' })] });
    await syncPlanFromStripe(event('invoice.payment_failed', { customer: 'cus_1' }));
    expect(planGranted()).toEqual(['pro']);
    expect(lastBillingRow()).toMatchObject({ subscription_status: 'past_due' });
  });

  it('paiement réussi après relance : retour à actif', async () => {
    await syncPlanFromStripe(event('invoice.paid', { customer: 'cus_1' }));
    expect(lastBillingRow()).toMatchObject({ subscription_status: 'active', plan: 'pro' });
  });

  it('facture d’un client inconnu : rien', async () => {
    await syncPlanFromStripe(event('invoice.paid', { customer: 'cus_x' }));
    expect(db.rpcs).toEqual([]);
  });
});

describe('TVA et facturation du paiement', () => {
  it('rien d’activé par défaut : le paiement fonctionne comme avant', () => {
    expect(checkoutTaxOptions({})).toEqual({});
  });
  it('STRIPE_AUTOMATIC_TAX active la TVA automatique, l’adresse obligatoire et le numéro de TVA', () => {
    expect(checkoutTaxOptions({ STRIPE_AUTOMATIC_TAX: 'true' })).toEqual({
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
    });
  });
  it('STRIPE_REQUIRE_TERMS demande l’acceptation des CGV', () => {
    expect(checkoutTaxOptions({ STRIPE_REQUIRE_TERMS: 'true' })).toEqual({ consent_collection: { terms_of_service: 'required' } });
  });
});

describe('POST /api/billing/webhook', () => {
  const post = (body = 'payload') =>
    new Request('http://localhost/api/billing/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body });

  it('400 sans signature valide, rien n’est traité', async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => { throw new Error('No signatures found matching the expected signature for payload'); });
    const { POST } = await import('@/app/api/billing/webhook/route');
    const res = await POST(post());
    expect(res.status).toBe(400);
    expect(db.rpcs).toEqual([]);
  });

  it('un événement déjà traité n’est pas rejoué (livraison en double)', async () => {
    const evt = event('customer.subscription.deleted', subscription({ status: 'canceled' }), 'evt_dup');
    stripeMock.webhooks.constructEvent.mockReturnValue(evt);
    const { POST } = await import('@/app/api/billing/webhook/route');

    expect((await (await POST(post())).json())).toEqual({ received: true });
    expect(planGranted()).toEqual(['freemium']);

    const second = await (await POST(post())).json();
    expect(second).toEqual({ received: true, duplicate: true });
    expect(planGranted()).toEqual(['freemium']);
  });

  it('erreur interne : 500 (Stripe réessaiera) sans détail technique', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(event('invoice.paid', { customer: 'cus_1' }, 'evt_fail'));
    stripeMock.subscriptions.list.mockRejectedValue(new Error('timeout base de données interne'));
    const { POST } = await import('@/app/api/billing/webhook/route');
    const res = await POST(post());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('base de données');
    expect(db.processed.has('evt_fail')).toBe(false);
  });
});
